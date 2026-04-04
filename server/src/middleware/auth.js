import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { mapUser, query } from "../data/db.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization token" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const result = await query(
      "SELECT id, full_name, email, role, balance, created_at FROM users WHERE id = $1",
      [payload.sub]
    );
    const user = result.rows[0] ? mapUser(result.rows[0]) : null;

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}
