import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { mapMatch, query } from "../data/db.js";
import { roundTo2 } from "../utils/betting.js";
import {
  buildOddsPayload,
  getFootballQueryWindow,
  resolveFootballFeed
} from "../utils/footballFeed.js";

const router = express.Router();

function setRealtimeHeaders(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store"
  });
}

router.get("/football/matches", async (req, res) => {
  setRealtimeHeaders(res);
  const payload = await resolveFootballFeed(getFootballQueryWindow(req.query));
  return res.json(payload);
});

router.get("/football/odds", async (req, res) => {
  setRealtimeHeaders(res);
  const payload = await resolveFootballFeed(getFootballQueryWindow(req.query));
  return res.json({
    source: payload.source,
    sport: payload.sport,
    live: payload.live,
    odds: buildOddsPayload(payload.matches, payload.updatedAt),
    providerErrors: payload.providerErrors,
    updatedAt: payload.updatedAt
  });
});

router.get("/matches", async (req, res) => {
  setRealtimeHeaders(res);
  const payload = await resolveFootballFeed(getFootballQueryWindow(req.query));
  return res.json(payload);
});

router.get("/odds", async (req, res) => {
  setRealtimeHeaders(res);
  const payload = await resolveFootballFeed(getFootballQueryWindow(req.query));
  return res.json({
    source: payload.source,
    sport: payload.sport,
    live: payload.live,
    odds: buildOddsPayload(payload.matches, payload.updatedAt),
    providerErrors: payload.providerErrors,
    updatedAt: payload.updatedAt
  });
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
