import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { pool, query } from "../data/db.js";

const router = express.Router();

router.post("/payouts/:betId", requireAuth, async (req, res) => {
  const { betId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const betResult = await client.query(
      `SELECT id, user_id, potential_win, status, paid_out
       FROM bets
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [betId, req.user.id]
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
      userId: req.user.id,
      amount: payoutAmount,
      createdAt
    };

    await client.query("UPDATE bets SET paid_out = true WHERE id = $1", [bet.id]);
    await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [
      payoutAmount,
      req.user.id
    ]);
    await client.query(
      `INSERT INTO payouts (id, bet_id, user_id, amount, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [payout.id, payout.betId, payout.userId, payout.amount, payout.createdAt]
    );
    await client.query(
      `INSERT INTO transactions (id, user_id, type, status, amount, reference, created_at)
       VALUES ($1, $2, 'payout', 'completed', $3, $4, $5)`,
      [uuidv4(), req.user.id, payout.amount, bet.id, createdAt]
    );

    const balanceResult = await client.query("SELECT balance FROM users WHERE id = $1", [req.user.id]);

    await client.query("COMMIT");
    return res.status(201).json({
      message: "Payout completed",
      payout,
      balance: Number(balanceResult.rows[0].balance)
    });
  } catch {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to process payout" });
  } finally {
    client.release();
  }
});

router.get("/payouts", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, bet_id AS "betId", user_id AS "userId", amount, created_at AS "createdAt"
       FROM payouts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const payouts = result.rows.map((item) => ({ ...item, amount: Number(item.amount) }));
    return res.json({ payouts });
  } catch {
    return res.status(500).json({ error: "Failed to fetch payouts" });
  }
});

export default router;
