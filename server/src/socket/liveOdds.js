import { roundTo2 } from "../utils/betting.js";

export function startLiveOdds(io, store) {
  io.on("connection", (socket) => {
    socket.emit("odds:snapshot", { matches: store.matches });
  });

  setInterval(() => {
    for (const match of store.matches) {
      if (match.status !== "upcoming") {
        continue;
      }

      const drift = () => (Math.random() * 0.2 - 0.1);
      match.odds.home = Math.max(1.05, roundTo2(match.odds.home + drift()));
      match.odds.draw = Math.max(1.05, roundTo2(match.odds.draw + drift()));
      match.odds.away = Math.max(1.05, roundTo2(match.odds.away + drift()));
    }

    io.emit("odds:update", { matches: store.matches, updatedAt: new Date().toISOString() });
  }, 10000);
}
