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

export const config = {
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev_secret_change_me",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  databaseUrl: normalizedDatabaseUrl,
  databaseEnvCandidates
};
