import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { mapMatch, query } from "../data/db.js";
import { roundTo2 } from "../utils/betting.js";
import { fetchFootballMatchesAndOdds } from "../utils/footballApi.js";

const router = express.Router();

async function fetchInternalMatches() {
  const result = await query(
    `SELECT id, home_team, away_team, league, start_time, odds_home, odds_draw, odds_away, status, result
     FROM matches
     ORDER BY start_time ASC`
  );

  return result.rows.map(mapMatch);
}

router.get("/football/matches", async (req, res) => {
  try {
    const payload = await fetchFootballMatchesAndOdds();

    if (payload.matches.length) {
      return res.json({
        source: payload.source,
        sport: "football",
        matches: payload.matches
      });
    }

    const fallbackMatches = await fetchInternalMatches();

    return res.json({
      source: "internal-fallback",
      sport: "football",
      matches: fallbackMatches,
      providerErrors: payload.errors || []
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch football matches" });
  }
});

router.get("/football/odds", async (req, res) => {
  try {
    const payload = await fetchFootballMatchesAndOdds();

    if (payload.matches.length) {
      const odds = payload.matches.map((match) => ({
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        odds: match.odds,
        updatedAt: new Date().toISOString()
      }));

      return res.json({
        source: payload.source,
        sport: "football",
        odds
      });
    }

    const fallbackMatches = await fetchInternalMatches();
    const fallbackOdds = fallbackMatches.map((match) => ({
      matchId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      odds: match.odds,
      updatedAt: new Date().toISOString()
    }));

    return res.json({
      source: "internal-fallback",
      sport: "football",
      odds: fallbackOdds,
      providerErrors: payload.errors || []
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch football odds" });
  }
});

router.get("/matches", async (req, res) => {
  try {
    const result = await query(
      `SELECT id, home_team, away_team, league, start_time, odds_home, odds_draw, odds_away, status, result
       FROM matches
       ORDER BY start_time ASC`
    );
    return res.json({ matches: result.rows.map(mapMatch) });
  } catch {
    return res.status(500).json({ error: "Failed to fetch matches" });
  }
});

router.get("/odds", async (req, res) => {
  try {
    const result = await query(
      `SELECT id, home_team, away_team, odds_home, odds_draw, odds_away FROM matches ORDER BY start_time ASC`
    );

    const odds = result.rows.map((match) => ({
      matchId: match.id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      odds: {
        home: Number(match.odds_home),
        draw: Number(match.odds_draw),
        away: Number(match.odds_away)
      },
      updatedAt: new Date().toISOString()
    }));

    return res.json({ odds });
  } catch {
    return res.status(500).json({ error: "Failed to fetch odds" });
  }
});

router.patch("/matches/:matchId/odds", requireAuth, requireAdmin, async (req, res) => {
  const { matchId } = req.params;
  const { home, draw, away } = req.body;

  try {
    const current = await query(
      `SELECT id, home_team, away_team, league, start_time, odds_home, odds_draw, odds_away, status, result
       FROM matches WHERE id = $1`,
      [matchId]
    );

    if (!current.rowCount) {
      return res.status(404).json({ error: "Match not found" });
    }

    const row = current.rows[0];
    const updatedHome = home ? roundTo2(Number(home)) : Number(row.odds_home);
    const updatedDraw = draw ? roundTo2(Number(draw)) : Number(row.odds_draw);
    const updatedAway = away ? roundTo2(Number(away)) : Number(row.odds_away);

    const updated = await query(
      `UPDATE matches
       SET odds_home = $1, odds_draw = $2, odds_away = $3
       WHERE id = $4
       RETURNING id, home_team, away_team, league, start_time, odds_home, odds_draw, odds_away, status, result`,
      [updatedHome, updatedDraw, updatedAway, matchId]
    );

    return res.json({ message: "Odds updated", match: mapMatch(updated.rows[0]) });
  } catch {
    return res.status(500).json({ error: "Failed to update odds" });
  }
});

export default router;
