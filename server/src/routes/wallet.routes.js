import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../data/db.js";

const router = express.Router();

router.post("/deposit", requireAuth, async (req, res) => {
  const { amount, phoneNumber } = req.body;
  const parsedAmount = Number(amount);

  if (!parsedAmount || parsedAmount <= 0) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  if (!phoneNumber) {
    return res.status(400).json({ error: "phoneNumber is required for M-Pesa deposits" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance",
      [parsedAmount, req.user.id]
    );

    const newBalance = Number(userResult.rows[0].balance);

    const transaction = {
      id: uuidv4(),
      type: "deposit",
      provider: "mpesa",
      status: "completed",
      phoneNumber,
      amount: parsedAmount,
      userId: req.user.id,
      createdAt: new Date().toISOString()
    };

    await client.query(
      `INSERT INTO transactions (id, user_id, type, provider, status, phone_number, amount, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        transaction.id,
        transaction.userId,
        transaction.type,
        transaction.provider,
        transaction.status,
        transaction.phoneNumber,
        transaction.amount,
        transaction.createdAt
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Deposit completed",
      transaction,
      balance: newBalance
    });
  } catch {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Deposit failed" });
  } finally {
    client.release();
  }
});

router.post("/withdraw", requireAuth, async (req, res) => {
  const { amount } = req.body;
  const parsedAmount = Number(amount);

  if (!parsedAmount || parsedAmount <= 0) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query("SELECT balance FROM users WHERE id = $1 FOR UPDATE", [
      req.user.id
    ]);
    const currentBalance = Number(userResult.rows[0].balance);

    if (currentBalance < parsedAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const updated = await client.query(
      "UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance",
      [parsedAmount, req.user.id]
    );
    const newBalance = Number(updated.rows[0].balance);

    const transaction = {
      id: uuidv4(),
      type: "withdraw",
      status: "completed",
      amount: parsedAmount,
      userId: req.user.id,
      createdAt: new Date().toISOString()
    };

    await client.query(
      `INSERT INTO transactions (id, user_id, type, status, amount, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        transaction.id,
        transaction.userId,
        transaction.type,
        transaction.status,
        transaction.amount,
        transaction.createdAt
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Withdrawal completed",
      transaction,
      balance: newBalance
    });
  } catch {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Withdrawal failed" });
  } finally {
    client.release();
  }
});

export default router;
