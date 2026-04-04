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

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function mapMatchFromAny(item) {
  const id = pickString(item.id, item.matchId, item.eventId, item.fixture_id, item.game_id);
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
    league: pickString(item.league, item.competition, item.leagueName, "Football"),
    startTime: toIsoDate(item.startTime || item.start_time || item.commence_time || item.kickoff),
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

async function fetchClearSportsMatches() {
  const payload = await fetchJson(config.clearSportsBaseUrl, config.clearSportsFootballGamesPath, {
    apiKey: config.clearSportsApiKey,
    query: {
      sport: "football",
      league: config.footballLeague
    }
  });

  return asArray(payload).map(mapMatchFromAny).filter(Boolean);
}

async function fetchClearSportsOdds() {
  const payload = await fetchJson(config.clearSportsBaseUrl, config.clearSportsOddsPath, {
    apiKey: config.clearSportsApiKey,
    query: {
      sport: "football",
      league: config.footballLeague
    }
  });

  return asArray(payload).map(mapMatchFromAny).filter(Boolean);
}

async function fetchOddsApiEvents() {
  const payload = await fetchJson(config.oddsApiBaseUrl, config.oddsApiFootballEventsPath, {
    apiKey: config.oddsApiKey,
    query: {
      sport: "football",
      league: config.footballLeague
    }
  });

  return asArray(payload).map(mapMatchFromAny).filter(Boolean);
}

async function fetchOddsApiOdds() {
  const payload = await fetchJson(config.oddsApiBaseUrl, config.oddsApiOddsPath, {
    apiKey: config.oddsApiKey,
    query: {
      sport: "football",
      league: config.footballLeague
    }
  });

  return asArray(payload).map(mapMatchFromAny).filter(Boolean);
}

export async function fetchFootballMatchesAndOdds() {
  const attempts = [
    async () => {
      const [games, odds] = await Promise.all([fetchClearSportsMatches(), fetchClearSportsOdds()]);
      return mergeById(games, odds);
    },
    async () => {
      const [events, odds] = await Promise.all([fetchOddsApiEvents(), fetchOddsApiOdds()]);
      return mergeById(events, odds);
    }
  ];

  const errors = [];

  for (const attempt of attempts) {
    try {
      const matches = await attempt();
      if (matches.length) {
        return { matches, source: "external" };
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
