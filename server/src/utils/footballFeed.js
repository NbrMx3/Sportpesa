import { mapMatch, query } from "../data/db.js";
import { fetchFootballMatchesAndOdds } from "./footballApi.js";
import { buildLocalFallbackMatches } from "./localFallbackMatches.js";

function asQueryString(value) {
  if (Array.isArray(value)) {
    return asQueryString(value[0]);
  }

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampLimit(limit, defaultLimit = 120) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(Math.floor(parsed), 300);
}

function startOfTodayUtc(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function defaultMonthWindow(now = new Date()) {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    from: first.toISOString(),
    to: last.toISOString()
  };
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

function resolveInternalWindow(queryWindow = {}) {
  const date = asQueryString(queryWindow.date);
  const from = asQueryString(queryWindow.from);
  const to = asQueryString(queryWindow.to);
  const todayStart = startOfTodayUtc();
  let start;
  let end;

  if (date) {
    ({ start, end } = toDayWindow(date));
  } else {
    const monthWindow = defaultMonthWindow();
    start = new Date(from || monthWindow.from);
    end = new Date(to || monthWindow.to);
  }

  const safeStart = Number.isNaN(start.getTime()) ? todayStart : start;
  const safeEnd = Number.isNaN(end.getTime()) ? todayStart : end;
  const clippedStart = safeStart < todayStart ? todayStart : safeStart;

  return {
    start: clippedStart,
    end: safeEnd,
    empty: safeEnd < clippedStart
  };
}

export function getFootballQueryWindow(input = {}) {
  const limit = asQueryString(input.limit);
  const { start, end } = resolveInternalWindow(input);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    empty: end < start,
    limit
  };
}

export async function fetchInternalMatches(queryWindow = {}) {
  const { start, end, empty } = resolveInternalWindow(queryWindow);
  const limit = clampLimit(queryWindow.limit);

  if (empty) {
    return [];
  }

  const result = await query(
    `SELECT id, home_team, away_team, league, start_time, odds_home, odds_draw, odds_away, status, result
     FROM matches
     WHERE start_time >= $1
       AND start_time <= $2
     ORDER BY start_time ASC
     LIMIT $3`,
    [start.toISOString(), end.toISOString(), limit]
  );

  return result.rows.map(mapMatch);
}

export function buildOddsPayload(matches, updatedAt) {
  return matches.map((match) => ({
    matchId: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    odds: match.odds,
    updatedAt
  }));
}

export async function resolveFootballFeed(queryWindow = {}) {
  const updatedAt = new Date().toISOString();
  const normalizedWindow = getFootballQueryWindow(queryWindow);

  if (normalizedWindow.empty) {
    return {
      source: "filtered-window",
      sport: "football",
      live: true,
      matches: [],
      providerErrors: [],
      updatedAt
    };
  }

  try {
    const payload = await fetchFootballMatchesAndOdds(normalizedWindow);

    if (payload.matches.length) {
      return {
        source: payload.source,
        sport: "football",
        live: true,
        matches: payload.matches,
        providerErrors: payload.errors || [],
        updatedAt
      };
    }

    try {
      const internalMatches = await fetchInternalMatches(normalizedWindow);
      if (internalMatches.length) {
        return {
          source: "internal-fallback",
          sport: "football",
          live: false,
          matches: internalMatches,
          providerErrors: payload.errors || [],
          updatedAt
        };
      }
    } catch {
      // Fall through to generated local fixtures when the database is unavailable.
    }

    return {
      source: "local-fallback",
      sport: "football",
      live: false,
      matches: buildLocalFallbackMatches(normalizedWindow),
      providerErrors: payload.errors || [],
      updatedAt
    };
  } catch {
    return {
      source: "local-fallback",
      sport: "football",
      live: false,
      matches: buildLocalFallbackMatches(normalizedWindow),
      providerErrors: ["External providers and database unavailable"],
      updatedAt
    };
  }
}
