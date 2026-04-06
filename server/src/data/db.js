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
    phoneNumber: row.phone_number,
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

function toIsoAtUtc(date, hour, minute) {
  const value = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
      minute,
      0,
      0
    )
  );
  return value.toISOString();
}

function buildMonthlyDefaultMatches(now = new Date()) {
  const seasonTeams = [
    "Arsenal",
    "Chelsea",
    "Liverpool",
    "Manchester City",
    "Manchester United",
    "Tottenham",
    "Newcastle",
    "Brighton",
    "Barcelona",
    "Real Madrid",
    "Atletico Madrid",
    "Sevilla",
    "Valencia",
    "Villarreal",
    "Inter",
    "AC Milan",
    "Juventus",
    "Napoli",
    "Roma",
    "Lazio",
    "Bayern Munich",
    "Borussia Dortmund",
    "Leverkusen",
    "RB Leipzig",
    "PSG",
    "Marseille",
    "Monaco",
    "Lyon"
  ];

  const leagues = [
    "Premier League",
    "La Liga",
    "Serie A",
    "Bundesliga",
    "Ligue 1"
  ];

  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const daysInMonth = Math.round((nextMonth - firstDay) / (24 * 60 * 60 * 1000));
  const fixtures = [];

  for (let day = 0; day < daysInMonth; day += 1) {
    const baseDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day + 1));

    for (let slot = 0; slot < 3; slot += 1) {
      const teamOffset = (day * 6 + slot * 3) % seasonTeams.length;
      const homeTeam = seasonTeams[teamOffset];
      const awayTeam = seasonTeams[(teamOffset + 7 + day + slot) % seasonTeams.length];
      const league = leagues[(day + slot) % leagues.length];
      const startHour = slot === 0 ? 13 : slot === 1 ? 16 : 19;
      const startMinute = slot === 2 ? 45 : 30;
      const baseStrength = (day + slot * 2) % 9;
      const home = Number((1.65 + (baseStrength % 5) * 0.24).toFixed(2));
      const draw = Number((3.05 + (baseStrength % 4) * 0.2).toFixed(2));
      const away = Number((2.15 + ((baseStrength + 3) % 6) * 0.29).toFixed(2));

      fixtures.push({
        homeTeam,
        awayTeam,
        league,
        startTime: toIsoAtUtc(baseDate, startHour, startMinute),
        home,
        draw,
        away
      });
    }
  }

  return fixtures;
}

export async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone_number TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone_number TEXT;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique
    ON users (phone_number)
    WHERE phone_number IS NOT NULL;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked BOOLEAN NOT NULL DEFAULT FALSE,
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

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const monthCount = await query(
    `SELECT COUNT(*)::int AS count
     FROM matches
     WHERE start_time >= $1
       AND start_time < $2`,
    [monthStart.toISOString(), nextMonthStart.toISOString()]
  );

  if (monthCount.rows[0].count < 60) {
    const defaults = buildMonthlyDefaultMatches(now);

    for (const match of defaults) {
      const exists = await query(
        `SELECT 1
         FROM matches
         WHERE home_team = $1
           AND away_team = $2
           AND league = $3
           AND start_time = $4
         LIMIT 1`,
        [match.homeTeam, match.awayTeam, match.league, match.startTime]
      );

      if (exists.rowCount) {
        continue;
      }

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
