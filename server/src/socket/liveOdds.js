import { roundTo2 } from "../utils/betting.js";
import { mapMatch, query } from "../data/db.js";
import { buildLocalFallbackMatches } from "../utils/localFallbackMatches.js";

async function fetchMatches() {
  try {
    const result = await query(
      `SELECT id, home_team, away_team, league, start_time, odds_home, odds_draw, odds_away, status, result
       FROM matches
       ORDER BY start_time ASC`
    );
    return result.rows.map(mapMatch);
  } catch {
    return buildLocalFallbackMatches();
  }
}

export function startLiveOdds(io) {
  io.on("connection", async (socket) => {
    try {
      const matches = await fetchMatches();
      socket.emit("odds:snapshot", { matches });
    } catch {
      socket.emit("odds:snapshot", { matches: buildLocalFallbackMatches() });
    }
  });

  setInterval(async () => {
    try {
      const result = await query(
        `SELECT id, odds_home, odds_draw, odds_away
         FROM matches
         WHERE status = 'upcoming'`
      );

      for (const match of result.rows) {
        const drift = () => Math.random() * 0.2 - 0.1;
        const home = Math.max(1.05, roundTo2(Number(match.odds_home) + drift()));
        const draw = Math.max(1.05, roundTo2(Number(match.odds_draw) + drift()));
        const away = Math.max(1.05, roundTo2(Number(match.odds_away) + drift()));

        await query(
          `UPDATE matches
           SET odds_home = $1, odds_draw = $2, odds_away = $3
           WHERE id = $4`,
          [home, draw, away, match.id]
        );
      }
    } catch {
      // Keep socket updates alive in fallback mode when DB is unavailable.
    }

    const matches = await fetchMatches();
    io.emit("odds:update", { matches, updatedAt: new Date().toISOString() });
  }, 10000);
}
