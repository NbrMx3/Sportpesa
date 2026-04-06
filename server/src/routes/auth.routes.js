import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";
import { mapUser, query } from "../data/db.js";

const router = express.Router();
const googleClient = new OAuth2Client(config.googleClientId || undefined);

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: "8h" });
}

function signRefreshToken(tokenId, userId) {
  return jwt.sign({ sub: userId, tid: tokenId }, config.jwtRefreshSecret, { expiresIn: "7d" });
}

function normalizePhone(phoneNumber) {
  if (!phoneNumber) return null;
  return String(phoneNumber).replace(/\s+/g, "").trim();
}

function isAdminGoogleEmail(email) {
  return Boolean(email && config.adminGoogleEmails.includes(String(email).toLowerCase()));
}

router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;

    if (!fullName || !password) {
      return res.status(400).json({ error: "fullName and password are required" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: "email or phoneNumber is required" });
    }

    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
    const normalizedPhone = normalizePhone(phoneNumber);

    if (normalizedEmail) {
      const existingByEmail = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
      if (existingByEmail.rowCount) {
        return res.status(409).json({ error: "Email already in use" });
      }
    }

    if (normalizedPhone) {
      const existingByPhone = await query("SELECT id FROM users WHERE phone_number = $1", [
        normalizedPhone
      ]);
      if (existingByPhone.rowCount) {
        return res.status(409).json({ error: "Phone number already in use" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const inserted = await query(
      `INSERT INTO users (id, full_name, email, phone_number, password_hash, role, balance)
       VALUES ($1, $2, $3, $4, $5, 'user', 0)
       RETURNING id, full_name, email, phone_number, role, balance, created_at`,
      [
        userId,
        String(fullName).trim(),
        normalizedEmail || `${userId}@phone.local`,
        normalizedPhone,
        passwordHash
      ]
    );

    const user = mapUser(inserted.rows[0]);
    const accessToken = signAccessToken(user);
    const refreshTokenId = uuidv4();
    const refreshToken = signRefreshToken(refreshTokenId, user.id);

    await query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [refreshTokenId, user.id, refreshToken]
    );

    return res.status(201).json({ user, token: accessToken, accessToken, refreshToken });
  } catch {
    return res.status(500).json({ error: "Failed to signup" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, phoneNumber, identifier, password } = req.body;

    const incomingIdentifier = identifier || email || phoneNumber;

    if (!incomingIdentifier || !password) {
      return res.status(400).json({ error: "identifier (email/phoneNumber) and password are required" });
    }

    const rawIdentifier = String(incomingIdentifier).trim();
    const isEmail = rawIdentifier.includes("@");
    const normalizedIdentifier = isEmail ? rawIdentifier.toLowerCase() : normalizePhone(rawIdentifier);

    const result = await query(
      `SELECT id, full_name, email, phone_number, role, balance, created_at, password_hash
       FROM users
       WHERE ${isEmail ? "email" : "phone_number"} = $1`,
      [normalizedIdentifier]
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
    const accessToken = signAccessToken(safeUser);
    const refreshTokenId = uuidv4();
    const refreshToken = signRefreshToken(refreshTokenId, safeUser.id);

    await query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [refreshTokenId, safeUser.id, refreshToken]
    );

    return res.json({ user: safeUser, token: accessToken, accessToken, refreshToken });
  } catch {
    return res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/admin/login", async (req, res) => {
  try {
    const { email, phoneNumber, identifier, password } = req.body;

    const incomingIdentifier = identifier || email || phoneNumber;

    if (!incomingIdentifier || !password) {
      return res.status(400).json({ error: "identifier (email/phoneNumber) and password are required" });
    }

    const rawIdentifier = String(incomingIdentifier).trim();
    const isEmail = rawIdentifier.includes("@");
    const normalizedIdentifier = isEmail ? rawIdentifier.toLowerCase() : normalizePhone(rawIdentifier);

    const result = await query(
      `SELECT id, full_name, email, phone_number, role, balance, created_at, password_hash
       FROM users
       WHERE ${isEmail ? "email" : "phone_number"} = $1`,
      [normalizedIdentifier]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const safeUser = mapUser(user);
    const accessToken = signAccessToken(safeUser);
    const refreshTokenId = uuidv4();
    const refreshToken = signRefreshToken(refreshTokenId, safeUser.id);

    await query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [refreshTokenId, safeUser.id, refreshToken]
    );

    return res.json({ user: safeUser, token: accessToken, accessToken, refreshToken });
  } catch {
    return res.status(500).json({ error: "Failed to login admin" });
  }
});

router.post("/admin/google", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "idToken is required" });
    }

    if (!config.googleClientId) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID is not configured" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.googleClientId
    });

    const payload = ticket.getPayload();
    const googleEmail = payload?.email ? String(payload.email).toLowerCase() : "";

    if (!googleEmail) {
      return res.status(401).json({ error: "Google token does not contain an email" });
    }

    if (!isAdminGoogleEmail(googleEmail)) {
      return res.status(403).json({ error: "Google account is not authorized for admin access" });
    }

    let userResult = await query(
      `SELECT id, full_name, email, phone_number, role, balance, created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [googleEmail]
    );

    if (!userResult.rowCount) {
      const generatedPassword = await bcrypt.hash(uuidv4(), 10);
      const inserted = await query(
        `INSERT INTO users (id, full_name, email, phone_number, password_hash, role, balance)
         VALUES ($1, $2, $3, $4, $5, 'admin', 0)
         RETURNING id, full_name, email, phone_number, role, balance, created_at`,
        [uuidv4(), payload?.name || "Google Admin", googleEmail, null, generatedPassword]
      );
      userResult = inserted;
    } else if (userResult.rows[0].role !== "admin") {
      await query("UPDATE users SET role = 'admin' WHERE id = $1", [userResult.rows[0].id]);
      userResult = await query(
        `SELECT id, full_name, email, phone_number, role, balance, created_at
         FROM users
         WHERE id = $1`,
        [userResult.rows[0].id]
      );
    }

    const safeUser = mapUser(userResult.rows[0]);
    const accessToken = signAccessToken(safeUser);
    const refreshTokenId = uuidv4();
    const refreshToken = signRefreshToken(refreshTokenId, safeUser.id);

    await query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
      [refreshTokenId, safeUser.id, refreshToken]
    );

    return res.json({ user: safeUser, token: accessToken, accessToken, refreshToken });
  } catch {
    return res.status(401).json({ error: "Google authentication failed" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken is required" });
    }

    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret);
    const stored = await query(
      `SELECT id, user_id, token, revoked, expires_at
       FROM refresh_tokens
       WHERE id = $1 AND user_id = $2`,
      [payload.tid, payload.sub]
    );

    const storedToken = stored.rows[0];
    if (!storedToken || storedToken.revoked || storedToken.token !== refreshToken) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const userResult = await query(
      `SELECT id, full_name, email, phone_number, role, balance, created_at
       FROM users
       WHERE id = $1`,
      [payload.sub]
    );

    if (!userResult.rowCount) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = mapUser(userResult.rows[0]);
    const accessToken = signAccessToken(user);
    return res.json({ token: accessToken, accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken is required" });
    }

    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret);
    await query("UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1 AND user_id = $2", [
      payload.tid,
      payload.sub
    ]);

    return res.json({ message: "Logged out successfully" });
  } catch {
    return res.status(200).json({ message: "Logged out" });
  }
});

export default router;
