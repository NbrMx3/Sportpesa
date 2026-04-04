import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { sanitizeUser, store } from "../data/store.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: "8h" });
}

router.post("/signup", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "fullName, email and password are required" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existingUser = store.users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash,
    role: "user",
    balance: 0,
    createdAt: new Date().toISOString()
  };

  store.users.push(user);

  const token = signToken(user);
  return res.status(201).json({ user: sanitizeUser(user), token });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = store.users.find((item) => item.email === normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken(user);
  return res.json({ user: sanitizeUser(user), token });
});

export default router;
