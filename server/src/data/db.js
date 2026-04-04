import bcrypt from "bcrypt";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export function mapUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    balance: Number(row.balance),
    createdAt: row.created_at
  };
}

export function mapMatch(row) {
  return {
    id: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    league: row.league,
    startTime: row.start_time,
    odds: {
      home: Number(row.odds_home),
      draw: Number(row.odds_draw),
      away: Number(row.odds_away)
    },
    status: row.status,
    result: row.result
  };
}

export function mapBet(row) {
  return {
    id: row.id,
    userId: row.user_id,
    stake: Number(row.stake),
    combinedOdds: Number(row.combined_odds),
    potentialWin: Number(row.potential_win),
    selections: row.selections,
    status: row.status,
    paidOut: row.paid_out,
    createdAt: row.created_at
  };
}

export async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      league TEXT NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      odds_home NUMERIC(8, 2) NOT NULL,
      odds_draw NUMERIC(8, 2) NOT NULL,
      odds_away NUMERIC(8, 2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      result TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      provider TEXT,
      status TEXT NOT NULL,
      phone_number TEXT,
      amount NUMERIC(12, 2) NOT NULL,
      reference TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stake NUMERIC(12, 2) NOT NULL,
      combined_odds NUMERIC(10, 2) NOT NULL,
      potential_win NUMERIC(12, 2) NOT NULL,
      selections JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_out BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      bet_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const adminEmail = "admin@sportpesa.local";
  const existingAdmin = await query("SELECT id FROM users WHERE email = $1", [adminEmail]);

  if (!existingAdmin.rowCount) {
    const passwordHash = await bcrypt.hash("Admin123!", 10);
    await query(
      `INSERT INTO users (id, full_name, email, password_hash, role, balance)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), "System Admin", adminEmail, passwordHash, "admin", 50000]
    );
  }

  const matchCount = await query("SELECT COUNT(*)::int AS count FROM matches");

  if (!matchCount.rows[0].count) {
    const now = Date.now();
    const defaults = [
      {
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        league: "Premier League",
        startTime: new Date(now + 60 * 60 * 1000).toISOString(),
        home: 2.5,
        draw: 3.2,
        away: 2.8
      },
      {
        homeTeam: "Barcelona",
        awayTeam: "Atletico Madrid",
        league: "La Liga",
        startTime: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        home: 1.8,
        draw: 3.4,
        away: 4.2
      }
    ];

    for (const match of defaults) {
      await query(
        `INSERT INTO matches (id, home_team, away_team, league, start_time, odds_home, odds_draw, odds_away, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'upcoming')`,
        [
          uuidv4(),
          match.homeTeam,
          match.awayTeam,
          match.league,
          match.startTime,
          match.home,
          match.draw,
          match.away
        ]
      );
    }
  }
}
