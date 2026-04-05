import http from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { config } from "./config.js";
import { initDatabase } from "./data/db.js";
import { startLiveOdds } from "./socket/liveOdds.js";

async function startServer() {
  if (!config.databaseUrl) {
    throw new Error(
      `Database URL missing. Set one of: ${config.databaseEnvCandidates.join(", ")}`
    );
  }

  await initDatabase();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: config.clientOrigin,
      methods: ["GET", "POST", "PATCH"]
    }
  });

  startLiveOdds(io);

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(
        `Port ${config.port} is already in use. Stop the other server process or set a different PORT in server/.env.`
      );
      process.exit(1);
    }

    console.error("Server runtime error", error);
    process.exit(1);
  });

  server.listen(config.port, () => {
    console.log(`Sportpesa API running on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed", error);
  process.exit(1);
});
