import { config } from "../config.js";

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  if (Array.isArray(value?.events)) {
    return value.events;
  }

  if (Array.isArray(value?.games)) {
    return value.games;
  }

  return [];
}

function parseLeagues() {
  const listFromCsv = String(config.footballLeagues || "")
    .split(",")
    .map((league) => league.trim())
    .filter(Boolean);

  const fallbackLeague = String(config.footballLeague || "").trim();

  const merged = [...listFromCsv];
  if (fallbackLeague && !merged.includes(fallbackLeague)) {
    merged.push(fallbackLeague);
  }

  return merged;
}

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

function clampLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return config.footballMaxMatches;
  }

  return Math.min(Math.floor(parsed), 300);
}

function asValidDateOrFallback(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function pickNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function toIsoDate(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

async function fetchJson(baseUrl, path, { apiKey, query = {} } = {}) {
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey, Authorization: `Bearer ${apiKey}` } : {})
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const raw = await response.text();
    if (!raw) {
      return {};
    }

    return JSON.parse(raw);
  } finally {
    clearTimeout(timeout);
  }
}

function mapMatchFromAny(item) {
  const id = pickString(
    item.id,
    item.matchId,
    item.eventId,
    item.fixture_id,
    item.game_id,
    item.fixture?.id,
    item.event?.id,
    item.game?.id,
    item.match?.id
  );
  const homeTeam = pickString(
    item.homeTeam,
    item.home_team,
    item.home,
    item.homeName,
    item.teams?.home?.name,
    item.teams?.home
  );
  const awayTeam = pickString(
    item.awayTeam,
    item.away_team,
    item.away,
    item.awayName,
    item.teams?.away?.name,
    item.teams?.away
  );

  if (!id || !homeTeam || !awayTeam) {
    return null;
  }

  const home = pickNumber(item.odds?.home, item.odds_home, item.homeOdds, item.prices?.home);
  const draw = pickNumber(item.odds?.draw, item.odds_draw, item.drawOdds, item.prices?.draw);
  const away = pickNumber(item.odds?.away, item.odds_away, item.awayOdds, item.prices?.away);

  return {
    id,
    homeTeam,
    awayTeam,
    league: pickString(
      item.league,
      item.competition,
      item.leagueName,
      item.league?.name,
      item.competition?.name,
      item.tournament?.name,
      "Football"
    ),
    startTime: toIsoDate(
      item.startTime ||
        item.start_time ||
        item.commence_time ||
        item.kickoff ||
        item.commenceTime ||
        item.startDate ||
        item.fixture?.date
    ),
    odds: {
      home: home ?? 1.5,
      draw: draw ?? 3.0,
      away: away ?? 2.5
    },
    status: pickString(item.status, item.state, "upcoming"),
    result: pickString(item.result) || null
  };
}

function mergeById(primaryMatches, oddsMatches) {
  const byId = new Map(primaryMatches.map((match) => [match.id, { ...match }]));

  for (const oddsItem of oddsMatches) {
    const existing = byId.get(oddsItem.id);

    if (!existing) {
      byId.set(oddsItem.id, oddsItem);
      continue;
    }

    existing.odds = {
      home: pickNumber(oddsItem.odds?.home, existing.odds?.home) ?? 1.5,
      draw: pickNumber(oddsItem.odds?.draw, existing.odds?.draw) ?? 3.0,
      away: pickNumber(oddsItem.odds?.away, existing.odds?.away) ?? 2.5
    };
  }

  return Array.from(byId.values()).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

function applyWindowAndLimit(matches, { date, from, to, limit }) {
  const today = date || toDateOnlyUtc();
  const { start, end } = toDayWindow(today);

  const fromDate = from ? new Date(from) : start;
  const toDate = to ? new Date(to) : end;

  const safeFrom = Number.isNaN(fromDate.getTime()) ? start : fromDate;
  const safeTo = Number.isNaN(toDate.getTime()) ? end : toDate;
  const safeLimit = clampLimit(limit);

  const inWindow = matches.filter((match) => {
    const startTime = new Date(match.startTime);
    if (Number.isNaN(startTime.getTime())) {
      return false;
    }

    return startTime >= safeFrom && startTime <= safeTo;
  });

  const selected = inWindow.length ? inWindow : matches;
  return selected.slice(0, safeLimit);
}

async function fetchForLeagues(fetcher, options) {
  const configuredLeagues = parseLeagues();
  const leaguesToTry = configuredLeagues.length
    ? [...configuredLeagues, null]
    : [null];

  const settled = await Promise.allSettled(leaguesToTry.map((league) => fetcher(league, options)));

  const matches = [];
  const errors = [];

  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") {
      matches.push(...outcome.value);
      continue;
    }

    const leagueLabel = leaguesToTry[index] || "all-leagues";
    const message = outcome.reason instanceof Error ? outcome.reason.message : "Unknown provider error";
    errors.push(`${leagueLabel}: ${message}`);
  }

  const uniqueById = new Map();
  for (const match of matches) {
    if (!uniqueById.has(match.id)) {
      uniqueById.set(match.id, match);
    }
  }

  return { matches: Array.from(uniqueById.values()), errors };
}

function providerQuery(league, { date, from, to, limit }) {
  const safeDate = date || toDateOnlyUtc();
  const { start, end } = toDayWindow(safeDate);
  const safeFrom = asValidDateOrFallback(from, start);
  const safeTo = asValidDateOrFallback(to, end);

  return {
    sport: "football",
    ...(league ? { league } : {}),
    date: safeDate,
    day: safeDate,
    today: 1,
    from: safeFrom.toISOString(),
    to: safeTo.toISOString(),
    startDate: safeFrom.toISOString(),
    endDate: safeTo.toISOString(),
    date_from: safeFrom.toISOString(),
    date_to: safeTo.toISOString(),
    commenceTimeFrom: safeFrom.toISOString(),
    commenceTimeTo: safeTo.toISOString(),
    pageSize: clampLimit(limit),
    per_page: clampLimit(limit),
    limit: clampLimit(limit)
  };
}

async function fetchClearSportsMatches(league, options) {
  const payload = await fetchJson(config.clearSportsBaseUrl, config.clearSportsFootballGamesPath, {
    apiKey: config.clearSportsApiKey,
    query: providerQuery(league, options)
  });

  return asArray(payload).map(mapMatchFromAny).filter(Boolean);
}

async function fetchClearSportsOdds(league, options) {
  const payload = await fetchJson(config.clearSportsBaseUrl, config.clearSportsOddsPath, {
    apiKey: config.clearSportsApiKey,
    query: providerQuery(league, options)
  });

  return asArray(payload).map(mapMatchFromAny).filter(Boolean);
}

async function fetchOddsApiEvents(league, options) {
  const payload = await fetchJson(config.oddsApiBaseUrl, config.oddsApiFootballEventsPath, {
    apiKey: config.oddsApiKey,
    query: providerQuery(league, options)
  });

  return asArray(payload).map(mapMatchFromAny).filter(Boolean);
}

async function fetchOddsApiOdds(league, options) {
  const payload = await fetchJson(config.oddsApiBaseUrl, config.oddsApiOddsPath, {
    apiKey: config.oddsApiKey,
    query: providerQuery(league, options)
  });

  return asArray(payload).map(mapMatchFromAny).filter(Boolean);
}

export async function fetchFootballMatchesAndOdds(options = {}) {
  const attempts = [
    async () => {
      const [gamesResult, oddsResult] = await Promise.all([
        fetchForLeagues(fetchClearSportsMatches, options),
        fetchForLeagues(fetchClearSportsOdds, options)
      ]);

      return {
        matches: applyWindowAndLimit(mergeById(gamesResult.matches, oddsResult.matches), options),
        errors: [...gamesResult.errors, ...oddsResult.errors]
      };
    },
    async () => {
      const [eventsResult, oddsResult] = await Promise.all([
        fetchForLeagues(fetchOddsApiEvents, options),
        fetchForLeagues(fetchOddsApiOdds, options)
      ]);

      return {
        matches: applyWindowAndLimit(mergeById(eventsResult.matches, oddsResult.matches), options),
        errors: [...eventsResult.errors, ...oddsResult.errors]
      };
    }
  ];

  const errors = [];

  for (const attempt of attempts) {
    try {
      const { matches, errors: providerErrors } = await attempt();
      errors.push(...providerErrors);

      if (matches.length) {
        return { matches, source: "external", errors };
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown external API error");
    }
  }

  return {
    matches: [],
    source: "none",
    errors
  };
}
