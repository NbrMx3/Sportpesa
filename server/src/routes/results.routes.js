import express from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { mapMatch, query } from "../data/db.js";

const router = express.Router();

router.post("/results", requireAuth, requireAdmin, async (req, res) => {
  const { matchId, result } = req.body;

  if (!matchId || !result) {
    return res.status(400).json({ error: "matchId and result are required" });
  }

  if (!["home", "draw", "away"].includes(result)) {
    return res.status(400).json({ error: "result must be home, draw or away" });
  }

  try {
    const updatedMatch = await query(
      `UPDATE matches
       SET result = $1, status = 'finished'
       WHERE id = $2
       RETURNING id, home_team, away_team, league, start_time, odds_home, odds_draw, odds_away, status, result`,
      [result, matchId]
    );

    if (!updatedMatch.rowCount) {
      return res.status(404).json({ error: "Match not found" });
    }

    const betResult = await query(
      `SELECT id, selections
       FROM bets
       WHERE status = 'pending'
         AND selections @> $1::jsonb`,
      [JSON.stringify([{ matchId }])]
    );

    const updatedBets = [];

    for (const bet of betResult.rows) {
      const selections = bet.selections;
      const selectionCheck = selections.find((selection) => selection.matchId === matchId);

      if (!selectionCheck) {
        continue;
      }

      if (selectionCheck.predictedOutcome !== result) {
        await query("UPDATE bets SET status = 'lost' WHERE id = $1", [bet.id]);
        updatedBets.push({ betId: bet.id, status: "lost" });
        continue;
      }

      const remainingMatchIds = selections
        .filter((selection) => selection.matchId !== matchId)
        .map((selection) => selection.matchId);

      if (!remainingMatchIds.length) {
        await query("UPDATE bets SET status = 'won' WHERE id = $1", [bet.id]);
        updatedBets.push({ betId: bet.id, status: "won" });
        continue;
      }

      const matchState = await query(
        `SELECT id, result
         FROM matches
         WHERE id = ANY($1::text[])`,
        [remainingMatchIds]
      );

      const stateById = new Map(matchState.rows.map((row) => [row.id, row.result]));
      const allSettled = remainingMatchIds.every((id) => stateById.get(id));

      if (!allSettled) {
        updatedBets.push({ betId: bet.id, status: "pending" });
        continue;
      }

      const allCorrect = selections.every((selection) => {
        const actual = selection.matchId === matchId ? result : stateById.get(selection.matchId);
        return actual === selection.predictedOutcome;
      });

      const finalStatus = allCorrect ? "won" : "lost";
      await query("UPDATE bets SET status = $1 WHERE id = $2", [finalStatus, bet.id]);
      updatedBets.push({ betId: bet.id, status: finalStatus });
    }

    return res.status(201).json({
      message: "Result processed",
      match: mapMatch(updatedMatch.rows[0]),
      updatedBets
    });
  } catch {
    return res.status(500).json({ error: "Failed to process result" });
  }
});

export default router;
