import dotenv from "dotenv";

dotenv.config();

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRESQL_URL ||
  process.env.NEON_DATABASE_URL ||
  "";

export const config = {
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  databaseUrl
};
