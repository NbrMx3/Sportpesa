import dotenv from "dotenv";

dotenv.config();

const databaseEnvCandidates = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRESQL_URL",
  "NEON_DATABASE_URL",
  "DB_URL",
  "DATABASE_URI"
];

const selectedDatabaseUrl =
  databaseEnvCandidates
    .map((name) => process.env[name])
    .find((value) => typeof value === "string" && value.trim().length > 0) || "";

export const config = {
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  databaseUrl: selectedDatabaseUrl,
  databaseEnvCandidates
};
