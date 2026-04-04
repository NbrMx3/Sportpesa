import http from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { config } from "./config.js";
import { store } from "./data/store.js";
import { startLiveOdds } from "./socket/liveOdds.js";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.clientOrigin,
    methods: ["GET", "POST", "PATCH"]
  }
});

startLiveOdds(io, store);

server.listen(config.port, () => {
  console.log(`Sportpesa API running on port ${config.port}`);
});
