import dotenv from "dotenv";

dotenv.config();

const databaseEnvCandidates = [
  "DATABASE_URL",
  "DATABASEURL",
  "POSTGRES_URL",
  "POSTGRESQL_URL",
  "POSTGRES_URI",
  "PG_URL",
  "PG_URI",
  "NEON_DATABASE_URL",
  "NEON_URL",
  "DB_URL",
  "DATABASE_URI"
];

const selectedDatabaseUrl =
  databaseEnvCandidates
    .map((name) => process.env[name])
    .find((value) => typeof value === "string" && value.trim().length > 0) || "";

const normalizedDatabaseUrl = selectedDatabaseUrl
  .trim()
  .replace(/^['\"]/, "")
  .replace(/['\"]$/, "");

function normalizeSslMode(databaseUrl) {
  if (!databaseUrl) {
    return databaseUrl;
  }

  try {
    const url = new URL(databaseUrl);
    const sslmode = (url.searchParams.get("sslmode") || "").toLowerCase();

    if (["prefer", "require", "verify-ca"].includes(sslmode)) {
      // Explicitly pin to verify-full to match current pg behavior and silence warnings.
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export const config = {
  port: Number(process.env.PORT || 5001),
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev_secret_change_me",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  databaseUrl: normalizeSslMode(normalizedDatabaseUrl),
  databaseEnvCandidates,
  clearSportsBaseUrl: process.env.CLEARSPORTS_BASE_URL || "https://api.clearsports.dev",
  clearSportsApiKey: process.env.CLEARSPORTS_API_KEY || "",
  clearSportsFootballGamesPath: process.env.CLEARSPORTS_FOOTBALL_GAMES_PATH || "/v1/football/games",
  clearSportsOddsPath: process.env.CLEARSPORTS_ODDS_PATH || "/v1/odds",
  oddsApiBaseUrl: process.env.ODDS_API_BASE_URL || "https://api.odds-api.io",
  oddsApiKey: process.env.ODDS_API_KEY || "",
  oddsApiFootballEventsPath: process.env.ODDS_API_FOOTBALL_EVENTS_PATH || "/v3/events",
  oddsApiOddsPath: process.env.ODDS_API_ODDS_PATH || "/v3/odds",
  footballLeague: process.env.FOOTBALL_LEAGUE || "epl",
  footballLeagues: process.env.FOOTBALL_LEAGUES || "",
  footballMaxMatches: Number(process.env.FOOTBALL_MAX_MATCHES || 120),
  liveOddsRefreshMs: Math.max(Number(process.env.LIVE_ODDS_REFRESH_MS || 10000), 5000),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  adminGoogleEmails: String(process.env.ADMIN_GOOGLE_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
};
