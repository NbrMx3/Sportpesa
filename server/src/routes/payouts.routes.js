import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { findUserById, store } from "../data/store.js";

const router = express.Router();

router.post("/payouts/:betId", requireAuth, (req, res) => {
  const { betId } = req.params;
  const bet = store.bets.find((item) => item.id === betId && item.userId === req.user.id);

  if (!bet) {
    return res.status(404).json({ error: "Bet not found" });
  }

  if (bet.status !== "won") {
    return res.status(400).json({ error: "Only won bets can be paid out" });
  }

  if (bet.paidOut) {
    return res.status(400).json({ error: "Bet already paid" });
  }

  const user = findUserById(req.user.id);
  user.balance += bet.potentialWin;
  bet.paidOut = true;

  const payout = {
    id: uuidv4(),
    betId: bet.id,
    userId: user.id,
    amount: bet.potentialWin,
    createdAt: new Date().toISOString()
  };

  store.payouts.push(payout);
  store.transactions.push({
    id: uuidv4(),
    userId: user.id,
    type: "payout",
    amount: bet.potentialWin,
    status: "completed",
    reference: bet.id,
    createdAt: new Date().toISOString()
  });

  return res.status(201).json({ message: "Payout completed", payout, balance: user.balance });
});

router.get("/payouts", requireAuth, (req, res) => {
  const payouts = store.payouts.filter((item) => item.userId === req.user.id);
  return res.json({ payouts });
});

export default router;
