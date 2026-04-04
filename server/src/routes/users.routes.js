import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { store } from "../data/store.js";

const router = express.Router();

router.get("/me", requireAuth, (req, res) => {
  return res.json({ profile: req.user });
});

router.get("/me/transactions", requireAuth, (req, res) => {
  const history = store.transactions
    .filter((tx) => tx.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json({ transactions: history });
});

export default router;
