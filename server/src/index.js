import http from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { config } from "./config.js";
import { initDatabase } from "./data/db.js";
import { startLiveOdds } from "./socket/liveOdds.js";

async function startServer() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is missing. Set it in your environment.");
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

  server.listen(config.port, () => {
    console.log(`Sportpesa API running on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed", error);
  process.exit(1);
});
