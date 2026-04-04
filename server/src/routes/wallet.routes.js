import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { findUserById, store } from "../data/store.js";

const router = express.Router();

router.post("/deposit", requireAuth, (req, res) => {
  const { amount, phoneNumber } = req.body;
  const parsedAmount = Number(amount);

  if (!parsedAmount || parsedAmount <= 0) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  if (!phoneNumber) {
    return res.status(400).json({ error: "phoneNumber is required for M-Pesa deposits" });
  }

  const user = findUserById(req.user.id);
  user.balance += parsedAmount;

  const transaction = {
    id: uuidv4(),
    type: "deposit",
    provider: "mpesa",
    status: "completed",
    phoneNumber,
    amount: parsedAmount,
    userId: user.id,
    createdAt: new Date().toISOString()
  };

  store.transactions.push(transaction);

  return res.status(201).json({
    message: "Deposit completed",
    transaction,
    balance: user.balance
  });
});

router.post("/withdraw", requireAuth, (req, res) => {
  const { amount } = req.body;
  const parsedAmount = Number(amount);

  if (!parsedAmount || parsedAmount <= 0) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  const user = findUserById(req.user.id);

  if (user.balance < parsedAmount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  user.balance -= parsedAmount;

  const transaction = {
    id: uuidv4(),
    type: "withdraw",
    status: "completed",
    amount: parsedAmount,
    userId: user.id,
    createdAt: new Date().toISOString()
  };

  store.transactions.push(transaction);

  return res.status(201).json({
    message: "Withdrawal completed",
    transaction,
    balance: user.balance
  });
});

export default router;
