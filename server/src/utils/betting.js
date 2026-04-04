export function roundTo2(value) {
  return Math.round(value * 100) / 100;
}

export function computeCombinedOdds(lockedSelections) {
  const combined = lockedSelections.reduce((acc, selection) => {
    return acc * selection.lockedOdd;
  }, 1);

  return roundTo2(combined);
}

export function evaluateBet(bet, matchMap) {
  const allSettled = bet.selections.every((selection) => {
    const match = matchMap.get(selection.matchId);
    return match && match.result;
  });

  if (!allSettled) {
    return { status: "pending", won: false };
  }

  const won = bet.selections.every((selection) => {
    const match = matchMap.get(selection.matchId);
    return match.result === selection.predictedOutcome;
  });

  return { status: won ? "won" : "lost", won };
}
