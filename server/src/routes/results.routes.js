import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { store } from "../data/store.js";
import { evaluateBet } from "../utils/betting.js";

const router = express.Router();

router.post("/results", requireAuth, requireAdmin, (req, res) => {
  const { matchId, result } = req.body;

  if (!matchId || !result) {
    return res.status(400).json({ error: "matchId and result are required" });
  }

  if (!["home", "draw", "away"].includes(result)) {
    return res.status(400).json({ error: "result must be home, draw or away" });
  }

  const match = store.matches.find((item) => item.id === matchId);

  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }

  match.result = result;
  match.status = "finished";

  const matchMap = new Map(store.matches.map((item) => [item.id, item]));
  const updatedBets = [];

  for (const bet of store.bets) {
    const containsMatch = bet.selections.some((selection) => selection.matchId === matchId);

    if (!containsMatch) {
      continue;
    }

    const evaluation = evaluateBet(bet, matchMap);
    bet.status = evaluation.status;

    updatedBets.push({ betId: bet.id, status: bet.status });
  }

  return res.status(201).json({ message: "Result processed", match, updatedBets });
});

export default router;
