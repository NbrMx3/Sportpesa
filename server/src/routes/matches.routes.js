import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { store } from "../data/store.js";
import { roundTo2 } from "../utils/betting.js";

const router = express.Router();

router.get("/matches", (req, res) => {
  return res.json({ matches: store.matches });
});

router.get("/odds", (req, res) => {
  const odds = store.matches.map((match) => ({
    matchId: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    odds: match.odds,
    updatedAt: new Date().toISOString()
  }));

  return res.json({ odds });
});

router.patch("/matches/:matchId/odds", requireAuth, requireAdmin, (req, res) => {
  const { matchId } = req.params;
  const { home, draw, away } = req.body;
  const match = store.matches.find((item) => item.id === matchId);

  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }

  match.odds = {
    home: home ? roundTo2(Number(home)) : match.odds.home,
    draw: draw ? roundTo2(Number(draw)) : match.odds.draw,
    away: away ? roundTo2(Number(away)) : match.odds.away
  };

  return res.json({ message: "Odds updated", match });
});

export default router;
