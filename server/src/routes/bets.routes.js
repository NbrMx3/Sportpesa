import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { pool, query } from "../data/db.js";
import { computeCombinedOdds, roundTo2 } from "../utils/betting.js";

const router = express.Router();

const allowedOutcomes = new Set(["home", "draw", "away"]);

router.post("/bets", requireAuth, async (req, res) => {
  const { stake, selections } = req.body;
  const parsedStake = Number(stake);

  if (!parsedStake || parsedStake <= 0) {
    return res.status(400).json({ error: "Valid stake is required" });
  }

  if (!Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({ error: "At least one selection is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query("SELECT balance FROM users WHERE id = $1 FOR UPDATE", [
      req.user.id
    ]);
    const currentBalance = Number(userResult.rows[0].balance);

    if (currentBalance < parsedStake) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const lockedSelections = [];

    for (const selection of selections) {
      if (!allowedOutcomes.has(selection.predictedOutcome)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Invalid outcome: ${selection.predictedOutcome}` });
      }

      const matchResult = await client.query(
        `SELECT id, home_team, away_team, odds_home, odds_draw, odds_away
         FROM matches WHERE id = $1`,
        [selection.matchId]
      );

      if (!matchResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: `Match not found: ${selection.matchId}` });
      }

      const match = matchResult.rows[0];
      const oddsMap = {
        home: Number(match.odds_home),
        draw: Number(match.odds_draw),
        away: Number(match.odds_away)
      };

      lockedSelections.push({
        matchId: match.id,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        predictedOutcome: selection.predictedOutcome,
        lockedOdd: oddsMap[selection.predictedOutcome]
      });
    }

    const combinedOdds = computeCombinedOdds(lockedSelections);
    const potentialWin = roundTo2(parsedStake * combinedOdds);
    const betId = uuidv4();
    const createdAt = new Date().toISOString();

    await client.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [
      parsedStake,
      req.user.id
    ]);

    await client.query(
      `INSERT INTO bets
      (id, user_id, stake, combined_odds, potential_win, selections, status, paid_out, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', false, $7)`,
      [
        betId,
        req.user.id,
        parsedStake,
        combinedOdds,
        potentialWin,
        JSON.stringify(lockedSelections),
        createdAt
      ]
    );

    await client.query(
      `INSERT INTO transactions (id, user_id, type, status, amount, reference, created_at)
       VALUES ($1, $2, 'bet_stake', 'completed', $3, $4, $5)`,
      [uuidv4(), req.user.id, parsedStake, betId, createdAt]
    );

    const balanceResult = await client.query("SELECT balance FROM users WHERE id = $1", [req.user.id]);

    await client.query("COMMIT");

    const bet = {
      id: betId,
      userId: req.user.id,
      stake: parsedStake,
      combinedOdds,
      potentialWin,
      selections: lockedSelections,
      status: "pending",
      paidOut: false,
      createdAt
    };

    return res.status(201).json({
      message: "Bet placed successfully",
      formula: "Bet Amount x Odds = Potential Win",
      bet,
      balance: Number(balanceResult.rows[0].balance)
    });
  } catch {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Failed to place bet" });
  } finally {
    client.release();
  }
});

router.get("/bets/my", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, user_id, stake, combined_odds, potential_win, selections, status, paid_out, created_at
       FROM bets
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const bets = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      stake: Number(row.stake),
      combinedOdds: Number(row.combined_odds),
      potentialWin: Number(row.potential_win),
      selections: row.selections,
      status: row.status,
      paidOut: row.paid_out,
      createdAt: row.created_at
    }));

    return res.json({ bets });
  } catch {
    return res.status(500).json({ error: "Failed to fetch bets" });
  }
});

export default router;
