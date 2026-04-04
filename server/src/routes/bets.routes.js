import express from "express";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../middleware/auth.js";
import { findUserById, store } from "../data/store.js";
import { computeCombinedOdds, roundTo2 } from "../utils/betting.js";

const router = express.Router();

const allowedOutcomes = new Set(["home", "draw", "away"]);

router.post("/bets", requireAuth, (req, res) => {
  const { stake, selections } = req.body;
  const parsedStake = Number(stake);

  if (!parsedStake || parsedStake <= 0) {
    return res.status(400).json({ error: "Valid stake is required" });
  }

  if (!Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({ error: "At least one selection is required" });
  }

  const user = findUserById(req.user.id);

  if (user.balance < parsedStake) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  const lockedSelections = [];

  for (const selection of selections) {
    const match = store.matches.find((item) => item.id === selection.matchId);

    if (!match) {
      return res.status(404).json({ error: `Match not found: ${selection.matchId}` });
    }

    if (!allowedOutcomes.has(selection.predictedOutcome)) {
      return res.status(400).json({ error: `Invalid outcome: ${selection.predictedOutcome}` });
    }

    lockedSelections.push({
      matchId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      predictedOutcome: selection.predictedOutcome,
      lockedOdd: match.odds[selection.predictedOutcome]
    });
  }

  const combinedOdds = computeCombinedOdds(lockedSelections);
  const potentialWin = roundTo2(parsedStake * combinedOdds);

  user.balance -= parsedStake;

  const bet = {
    id: uuidv4(),
    userId: user.id,
    stake: parsedStake,
    combinedOdds,
    potentialWin,
    selections: lockedSelections,
    status: "pending",
    paidOut: false,
    createdAt: new Date().toISOString()
  };

  store.bets.push(bet);

  store.transactions.push({
    id: uuidv4(),
    userId: user.id,
    type: "bet_stake",
    amount: parsedStake,
    status: "completed",
    reference: bet.id,
    createdAt: new Date().toISOString()
  });

  return res.status(201).json({
    message: "Bet placed successfully",
    formula: "Bet Amount x Odds = Potential Win",
    bet,
    balance: user.balance
  });
});

router.get("/bets/my", requireAuth, (req, res) => {
  const bets = store.bets
    .filter((bet) => bet.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json({ bets });
});

export default router;
