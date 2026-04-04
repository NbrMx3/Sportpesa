import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

const now = new Date().toISOString();
const adminPasswordHash = bcrypt.hashSync("Admin123!", 10);

export const store = {
  users: [
    {
      id: uuidv4(),
      fullName: "System Admin",
      email: "admin@sportpesa.local",
      passwordHash: adminPasswordHash,
      role: "admin",
      balance: 50000,
      createdAt: now
    }
  ],
  matches: [
    {
      id: uuidv4(),
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      league: "Premier League",
      startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      odds: { home: 2.5, draw: 3.2, away: 2.8 },
      status: "upcoming",
      result: null
    },
    {
      id: uuidv4(),
      homeTeam: "Barcelona",
      awayTeam: "Atletico Madrid",
      league: "La Liga",
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      odds: { home: 1.8, draw: 3.4, away: 4.2 },
      status: "upcoming",
      result: null
    }
  ],
  transactions: [],
  bets: [],
  payouts: []
};

export function findUserById(userId) {
  return store.users.find((user) => user.id === userId) || null;
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
