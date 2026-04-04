import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { sanitizeUser, store } from "../data/store.js";

const router = express.Router();

router.get("/admin/users", requireAuth, requireAdmin, (req, res) => {
  const users = store.users.map((user) => sanitizeUser(user));
  return res.json({ users });
});

router.get("/admin/bets", requireAuth, requireAdmin, (req, res) => {
  return res.json({ bets: store.bets });
});

router.get("/admin/fraud-signals", requireAuth, requireAdmin, (req, res) => {
  const signals = [];

  for (const user of store.users) {
    const userBets = store.bets.filter((bet) => bet.userId === user.id);
    const userWithdrawals = store.transactions.filter(
      (tx) => tx.userId === user.id && tx.type === "withdraw"
    );

    const highStakeBets = userBets.filter((bet) => bet.stake >= 10000).length;

    if (userWithdrawals.length >= 5 || highStakeBets >= 3) {
      signals.push({
        userId: user.id,
        email: user.email,
        withdrawalCount: userWithdrawals.length,
        highStakeBets,
        reason: "Unusual withdrawal or stake pattern"
      });
    }
  }

  return res.json({ signals });
});

export default router;
