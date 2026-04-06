import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { mapBet, mapUser, pool, query } from "../data/db.js";

const router = express.Router();

router.get("/admin/overview", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [usersCount, betsCount, pendingBetsCount, wonBetsCount, payoutsCount, matchesCount] =
      await Promise.all([
        query("SELECT COUNT(*)::int AS count FROM users"),
        query("SELECT COUNT(*)::int AS count FROM bets"),
        query("SELECT COUNT(*)::int AS count FROM bets WHERE status = 'pending'"),
        query("SELECT COUNT(*)::int AS count FROM bets WHERE status = 'won'"),
        query("SELECT COUNT(*)::int AS count FROM payouts"),
        query("SELECT COUNT(*)::int AS count FROM matches")
      ]);

    return res.json({
      overview: {
        users: usersCount.rows[0].count,
        bets: betsCount.rows[0].count,
        pendingBets: pendingBetsCount.rows[0].count,
        wonBets: wonBetsCount.rows[0].count,
        payouts: payoutsCount.rows[0].count,
        matches: matchesCount.rows[0].count
      }
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch admin overview" });
  }
});

router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, full_name, email, role, balance, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.json({ users: result.rows.map(mapUser) });
  } catch {
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/admin/bets", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, user_id, stake, combined_odds, potential_win, selections, status, paid_out, created_at
       FROM bets
       ORDER BY created_at DESC`
    );

    return res.json({ bets: result.rows.map(mapBet) });
  } catch {
    return res.status(500).json({ error: "Failed to fetch bets" });
  }
});

router.get("/admin/fraud-signals", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        u.id AS user_id,
        u.email,
        COUNT(*) FILTER (WHERE t.type = 'withdraw')::int AS withdrawal_count,
        COUNT(*) FILTER (WHERE b.stake >= 10000)::int AS high_stake_bets
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id
      LEFT JOIN bets b ON b.user_id = u.id
      GROUP BY u.id, u.email`
    );

    const signals = result.rows
      .filter((row) => row.withdrawal_count >= 5 || row.high_stake_bets >= 3)
      .map((row) => ({
        userId: row.user_id,
        email: row.email,
        withdrawalCount: row.withdrawal_count,
        highStakeBets: row.high_stake_bets,
        reason: "Unusual withdrawal or stake pattern"
      }));

    return res.json({ signals });
  } catch {
    return res.status(500).json({ error: "Failed to compute fraud signals" });
  }
});

router.get("/admin/transactions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, user_id AS "userId", type, provider, status, phone_number AS "phoneNumber", amount, reference,
              created_at AS "createdAt"
       FROM transactions
       ORDER BY created_at DESC
       LIMIT 300`
    );

    return res.json({
      transactions: result.rows.map((item) => ({
        ...item,
        amount: Number(item.amount)
      }))
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.post("/admin/payouts/:betId", requireAuth, requireAdmin, async (req, res) => {
  const { betId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const betResult = await client.query(
      `SELECT id, user_id, potential_win, status, paid_out
       FROM bets
       WHERE id = $1
       FOR UPDATE`,
      [betId]
    );

    const bet = betResult.rows[0];

    if (!bet) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bet not found" });
    }

    if (bet.status !== "won") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only won bets can be paid out" });
    }

    if (bet.paid_out) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Bet already paid" });
    }

    const payoutAmount = Number(bet.potential_win);
    const createdAt = new Date().toISOString();
    const payout = {
      id: uuidv4(),
      betId: bet.id,
      userId: bet.user_id,
      amount: payoutAmount,
      createdAt
    };

    await client.query("UPDATE bets SET paid_out = true WHERE id = $1", [bet.id]);
    await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [payoutAmount, bet.user_id]);
    await client.query(
      `INSERT INTO payouts (id, bet_id, user_id, amount, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [payout.id, payout.betId, payout.userId, payout.amount, payout.createdAt]
    );
    await client.query(
      `INSERT INTO transactions (id, user_id, type, status, amount, reference, created_at)
       VALUES ($1, $2, 'payout', 'completed', $3, $4, $5)`,
      [uuidv4(), bet.user_id, payout.amount, bet.id, createdAt]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Admin payout completed",
      payout
    });
  } catch {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to process admin payout" });
  } finally {
    client.release();
  }
});

export default router;
