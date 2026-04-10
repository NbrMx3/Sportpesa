function toDateOnlyUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toDayWindow(dateOnly) {
  const parsed = dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`) : new Date();
  const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const start = new Date(base);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(base);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

function startOfTodayUtc(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function asValidDateOrFallback(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function clampLimit(limit, defaultLimit = 120) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.floor(parsed), 300);
}

function buildRange(from, to, date, limit) {
  const safeDate = date || toDateOnlyUtc();
  const { start, end } = toDayWindow(safeDate);
  const todayStart = startOfTodayUtc();
  const safeFrom = asValidDateOrFallback(from, start);
  const safeTo = asValidDateOrFallback(to, end);
  const clippedFrom = safeFrom < todayStart ? todayStart : safeFrom;

  return {
    from: clippedFrom,
    to: safeTo,
    limit: clampLimit(limit),
    empty: safeTo < clippedFrom
  };
}

export function buildLocalFallbackMatches({ from, to, date, limit } = {}) {
  const seasonTeams = [
    "Arsenal",
    "Chelsea",
    "Liverpool",
    "Manchester City",
    "Manchester United",
    "Tottenham",
    "Newcastle",
    "Brighton",
    "Barcelona",
    "Real Madrid",
    "Atletico Madrid",
    "Sevilla",
    "Valencia",
    "Villarreal",
    "Inter",
    "AC Milan",
    "Juventus",
    "Napoli",
    "Roma",
    "Lazio",
    "Bayern Munich",
    "Borussia Dortmund",
    "Leverkusen",
    "RB Leipzig",
    "PSG",
    "Marseille",
    "Monaco",
    "Lyon"
  ];

  const leagues = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];

  const range = buildRange(from, to, date, limit);
  const matches = [];

  if (range.empty) {
    return matches;
  }

  const cursor = new Date(range.from);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= range.to && matches.length < range.limit) {
    const day = cursor.getUTCDate();

    for (let slot = 0; slot < 3 && matches.length < range.limit; slot += 1) {
      const teamOffset = (day * 6 + slot * 3) % seasonTeams.length;
      const homeTeam = seasonTeams[teamOffset];
      const awayTeam = seasonTeams[(teamOffset + 7 + day + slot) % seasonTeams.length];
      const league = leagues[(day + slot) % leagues.length];
      const hour = slot === 0 ? 13 : slot === 1 ? 16 : 19;
      const minute = slot === 2 ? 45 : 30;
      const kickoff = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
          hour,
          minute,
          0,
          0
        )
      );

      if (kickoff < range.from || kickoff > range.to) {
        continue;
      }

      const baseStrength = (day + slot * 2) % 9;
      const home = Number((1.65 + (baseStrength % 5) * 0.24).toFixed(2));
      const draw = Number((3.05 + (baseStrength % 4) * 0.2).toFixed(2));
      const away = Number((2.15 + ((baseStrength + 3) % 6) * 0.29).toFixed(2));

      const id = `local-${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(
        cursor.getUTCDate()
      ).padStart(2, "0")}-${slot}`;

      matches.push({
        id,
        homeTeam,
        awayTeam,
        league,
        startTime: kickoff.toISOString(),
        odds: {
          home,
          draw,
          away
        },
        status: kickoff >= new Date() ? "upcoming" : "finished",
        result: null
      });
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return matches;
}
