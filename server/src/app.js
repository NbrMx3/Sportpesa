import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import matchesRoutes from "./routes/matches.routes.js";
import betsRoutes from "./routes/bets.routes.js";
import resultsRoutes from "./routes/results.routes.js";
import payoutsRoutes from "./routes/payouts.routes.js";
import adminRoutes from "./routes/admin.routes.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  return res.json({ status: "ok", now: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api", matchesRoutes);
app.use("/api", betsRoutes);
app.use("/api", resultsRoutes);
app.use("/api", payoutsRoutes);
app.use("/api", adminRoutes);

app.use((req, res) => {
  return res.status(404).json({ error: "Route not found" });
});
