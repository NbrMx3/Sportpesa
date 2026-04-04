import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { mapBet, mapUser, query } from "../data/db.js";

const router = express.Router();

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

export default router;
