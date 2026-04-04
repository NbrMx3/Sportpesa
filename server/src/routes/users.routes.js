import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { query } from "../data/db.js";

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
  return res.json({ profile: req.user });
});

router.get("/me/transactions", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, type, provider, status, phone_number AS "phoneNumber", amount, reference,
              created_at AS "createdAt"
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const history = result.rows.map((item) => ({
      ...item,
      amount: Number(item.amount)
    }));

    return res.json({ transactions: history });
  } catch {
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

export default router;
