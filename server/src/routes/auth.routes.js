import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { mapUser, query } from "../data/db.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: "8h" });
}

router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "fullName, email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);

    if (existingUser.rowCount) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const inserted = await query(
      `INSERT INTO users (id, full_name, email, password_hash, role, balance)
       VALUES ($1, $2, $3, $4, 'user', 0)
       RETURNING id, full_name, email, role, balance, created_at`,
      [userId, String(fullName).trim(), normalizedEmail, passwordHash]
    );

    const user = mapUser(inserted.rows[0]);
    const token = signToken(user);
    return res.status(201).json({ user, token });
  } catch {
    return res.status(500).json({ error: "Failed to signup" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const result = await query(
      `SELECT id, full_name, email, role, balance, created_at, password_hash
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const safeUser = mapUser(user);
    const token = signToken(safeUser);
    return res.json({ user: safeUser, token });
  } catch {
    return res.status(500).json({ error: "Failed to login" });
  }
});

export default router;
