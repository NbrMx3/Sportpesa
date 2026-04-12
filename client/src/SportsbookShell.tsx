import { useEffect, useMemo, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import "./App.css";

type MatchOutcome = "home" | "draw" | "away";
type Outcome = MatchOutcome | "homeDraw" | "drawAway" | "homeAway" | "over25" | "under25" | "bttsYes" | "bttsNo";

type Match = {
	id: string;
	homeTeam: string;
	awayTeam: string;
	league: string;
	sport: string;
	startTime: string;
	odds: Record<MatchOutcome, number>;
	status: string;
	result: MatchOutcome | null;
};

type ModuleKey =
	| "highlights"
	| "popular"
	| "goalRush"
	| "top5"
	| "countries"
	| "today"
	| "upcoming"
	| "efootball"
	| "basketball"
	| "tennis";

type TopNavKey =
	| "sports"
	| "liveGames"
	| "aviator"
	| "casino"
	| "virtuals"
	| "jackpots"
	| "luckyNumbers"
	| "more"
	| "apps";

type HeroSlide = {
	id: string;
	image: string;
	alt: string;
};

type BetSelection = {
	matchId: string;
	outcome: Outcome;
	apiOutcome: MatchOutcome | null;
	outcomeLabel: string;
	odd: number;
	label: string;
};

type UserProfile = {
	id: string;
	fullName: string;
	email: string;
	phoneNumber: string | null;
	role: string;
	balance: number;
};

type AdminOverview = {
	users: number;
	bets: number;
	pendingBets: number;
	wonBets: number;
	payouts: number;
	matches: number;
};

type ApiPayload = Record<string, unknown>;

type LiveFeedPayload = {
	matches?: Match[];
	source?: string;
	live?: boolean;
};

type LanguageCode = "en" | "sw";

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");
const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE || (import.meta.env.DEV ? "http://localhost:5001" : "");

const TOP_NAV_ITEMS: Array<{ key: TopNavKey; label: string; badge?: string; count?: number; hasCaret?: boolean }> = [
	{ key: "sports", label: "Sports" },
	{ key: "liveGames", label: "Live Games" },
	{ key: "aviator", label: "Aviator", badge: "NEW" },
	{ key: "casino", label: "Casino", count: 1 },
	{ key: "virtuals", label: "Virtuals" },
	{ key: "jackpots", label: "Jackpots", badge: "NEW" },
	{ key: "luckyNumbers", label: "Lucky Numbers", count: 7 },
	{ key: "more", label: "More", hasCaret: true },
	{ key: "apps", label: "Apps", hasCaret: true }
];

const FOOTBALL_MENU_ITEMS: Array<{ key: ModuleKey; label: string }> = [
	{ key: "highlights", label: "Highlights" },
	{ key: "popular", label: "Popular Games" },
	{ key: "goalRush", label: "Goal Rush" },
	{ key: "top5", label: "Top 5 Leagues" },
	{ key: "countries", label: "Countries" },
	{ key: "today", label: "Today Games" },
	{ key: "upcoming", label: "Upcoming Games" }
];

const TOP_LEAGUES_WITH_FLAGS = [
	{
		name: "Premier League",
		flag: "🏴󐁧󐁢󐁥󐁮󐁧󐁿",
		countries: [{ name: "England", flag: "🏴󐁧󐁢󐁥󐁮󐁧󐁿" }]
	},
	{
		name: "Primera Division",
		flag: "🇪🇸",
		countries: [{ name: "Spain", flag: "🇪🇸" }]
	},
	{
		name: "Ligue 1",
		flag: "🇫🇷",
		countries: [{ name: "France", flag: "🇫🇷" }]
	},
	{
		name: "Bundesliga",
		flag: "🇩🇪",
		countries: [{ name: "Germany", flag: "🇩🇪" }]
	},
	{
		name: "Serie A",
		flag: "🇮🇹",
		countries: [{ name: "Italy", flag: "🇮🇹" }]
	}
];

const EXTRA_SPORT_MENU_ITEMS: Array<{ key: ModuleKey; label: string; icon?: string }> = [
	{ key: "efootball", label: "eFootball", icon: "🎮" },
	{ key: "basketball", label: "Basketball", icon: "🏀" },
	{ key: "tennis", label: "Tennis", icon: "🎾" },
	{ key: "efootball", label: "Rugby Union", icon: "🏉" },
	{ key: "basketball", label: "Ice Hockey", icon: "🏒" },
	{ key: "tennis", label: "Volleyball", icon: "🏐" },
	{ key: "efootball", label: "Handball", icon: "🤾" },
	{ key: "basketball", label: "Cricket", icon: "🏏" },
	{ key: "tennis", label: "Baseball", icon: "⚾" },
	{ key: "efootball", label: "Boxing", icon: "🥊" }
];

const HERO_SLIDES: HeroSlide[] = [
	{
		id: "hero-1",
		image: "/hero-slide-1.svg",
		alt: "Football promo banner"
	},
	{
		id: "hero-2",
		image: "/hero-slide-2.svg",
		alt: "SportPesa registration banner"
	}
];

const HIGHLIGHT_TEAMS = new Set([
	"Arsenal",
	"Chelsea",
	"Liverpool",
	"Manchester City",
	"Manchester United",
	"Barcelona",
	"Real Madrid",
	"Bayern Munich",
	"PSG"
]);

const TOP_LEAGUES = new Set(["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"]);

const PAYBILL_INFO = [
	{ label: "M-PESA Paybill", value: "955100" },
	{ label: "SMS Registration", value: "GAME to 79079" }
];

const CUSTOMER_CARE_CONTACTS = ["0755 079 079", "0709 079 079", "care@ke.sportpesa.com"];

const RIGHT_RAIL_PROMOS: Array<{ key: string; image: string; alt: string }> = [
	{
		key: "jackpot-3m",
		image: "/promo-jackpot.svg",
		alt: "SportPesa jackpot promo"
	},
	{
		key: "win-5m",
		image: "/promo-planes.svg",
		alt: "SportPesa plane jackpot promo"
	},
	{
		key: "aviator",
		image: "/promo-aviator.svg",
		alt: "Aviator promo banner"
	},
	{
		key: "league",
		image: "/promo-league.svg",
		alt: "SportPesa league promo banner"
	},
	{
		key: "telegram",
		image: "/promo-telegram.svg",
		alt: "SportPesa Telegram promo banner"
	}
];

function roundTo2(value: number) {
	return Number(value.toFixed(2));
}

function toMonthInputValue(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

function getMonthWindow(monthValue: string) {
	const [yearRaw, monthRaw] = monthValue.split("-");
	const year = Number(yearRaw);
	const month = Number(monthRaw);
	const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();
	const safeMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;

	const start = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0, 0));
	const end = new Date(Date.UTC(safeYear, safeMonth, 0, 23, 59, 59, 999));
	const todayStart = startOfTodayUtc();

	return {
		from: start.getTime() < todayStart.getTime() ? todayStart.toISOString() : start.toISOString(),
		to: end.toISOString()
	};
}

function startOfTodayUtc() {
	const start = new Date();
	start.setUTCHours(0, 0, 0, 0);
	return start;
}

function matchDateKey(dateString: string) {
	return dateString.slice(0, 10);
}

function isCurrentOrFutureMatch(match: Match, todayStart = startOfTodayUtc()) {
	const kickoff = new Date(match.startTime);
	return !Number.isNaN(kickoff.getTime()) && kickoff.getTime() >= todayStart.getTime();
}

function formatKickoff(dateString: string) {
	return new Date(dateString).toLocaleString("en-KE", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	});
}

function formatNairobiClock(date = new Date()) {
	const time = date.toLocaleTimeString("en-KE", {
		timeZone: "Africa/Nairobi",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false
	});
	return `${time} EAT`;
}

function describeFootballFeed(source?: string, live?: boolean) {
	if (live || source === "external") {
		return "Live football feed connected";
	}

	if (source === "internal-fallback") {
		return "Using internal fallback odds";
	}

	if (source === "local-fallback") {
		return "Offline mode: local fixtures loaded";
	}

	return "Football feed connected";
}

function isUserProfile(payload: unknown): payload is UserProfile {
	if (!payload || typeof payload !== "object") {
		return false;
	}

	const candidate = payload as Record<string, unknown>;

	return (
		typeof candidate.id === "string" &&
		typeof candidate.fullName === "string" &&
		typeof candidate.email === "string" &&
		(candidate.phoneNumber === null || typeof candidate.phoneNumber === "string") &&
		typeof candidate.role === "string" &&
		typeof candidate.balance === "number"
	);
}

async function parseJsonSafely(response: Response): Promise<ApiPayload | null> {
	const rawBody = await response.text();

	if (!rawBody) {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(rawBody);
		return parsed && typeof parsed === "object" ? (parsed as ApiPayload) : null;
	} catch {
		return null;
	}
}

function getPayloadString(payload: ApiPayload | null, key: string) {
	const value = payload?.[key];
	return typeof value === "string" ? value : "";
}

function safeReadStoredUser() {
	try {
		const raw = localStorage.getItem("sportpesa_user");
		if (!raw) {
			return null;
		}

		const parsed: unknown = JSON.parse(raw);
		return isUserProfile(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function createSportFixture(
	monthValue: string,
	sport: string,
	league: string,
	home: string,
	away: string,
	day: number,
	slot: number
): Match {
	const [yearRaw, monthRaw] = monthValue.split("-");
	const year = Number(yearRaw);
	const month = Number(monthRaw);
	const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();
	const safeMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
	const startHour = slot === 0 ? 13 : slot === 1 ? 16 : 20;
	const start = new Date(Date.UTC(safeYear, safeMonth - 1, day, startHour, 15, 0, 0));
	const homeOdd = roundTo2(1.62 + ((day + slot) % 6) * 0.21);
	const drawOdd = roundTo2(2.95 + ((day + slot + 1) % 5) * 0.19);
	const awayOdd = roundTo2(1.7 + ((day + slot + 3) % 6) * 0.26);

	return {
		id: `${sport}-${safeYear}-${safeMonth}-${day}-${slot}-${home}-${away}`,
		homeTeam: home,
		awayTeam: away,
		league,
		sport,
		startTime: start.toISOString(),
		odds: {
			home: homeOdd,
			draw: drawOdd,
			away: awayOdd
		},
		status: "upcoming",
		result: null
	};
}

function buildLocalFootballMatches(monthValue: string) {
	const fixtures = [
		["Arsenal", "Chelsea", "Premier League", 2, 0],
		["Liverpool", "Manchester City", "Premier League", 5, 1],
		["Manchester United", "Tottenham", "Premier League", 8, 2],
		["Barcelona", "Atletico Madrid", "La Liga", 4, 1],
		["Real Madrid", "Sevilla", "La Liga", 11, 2],
		["Inter", "AC Milan", "Serie A", 6, 0],
		["Juventus", "Napoli", "Serie A", 13, 1],
		["Bayern Munich", "Borussia Dortmund", "Bundesliga", 9, 2],
		["Leverkusen", "RB Leipzig", "Bundesliga", 16, 0],
		["PSG", "Marseille", "Ligue 1", 7, 1],
		["Monaco", "Lyon", "Ligue 1", 18, 2],
		["Valencia", "Villarreal", "La Liga", 20, 0]
	] as const;

	return fixtures.map(([home, away, league, day, slot]) =>
		createSportFixture(monthValue, "Football", league, home, away, day, slot)
	);
}

function buildOtherSportsMatches(monthValue: string) {
	return [
		createSportFixture(monthValue, "eFootball", "eFootball Showcase", "eArsenal", "eChelsea", 3, 0),
		createSportFixture(monthValue, "eFootball", "eFootball Showcase", "eBarcelona", "eReal Madrid", 9, 1),
		createSportFixture(monthValue, "eFootball", "eFootball Showcase", "eBayern", "ePSG", 15, 2),
		createSportFixture(monthValue, "Basketball", "Basketball League", "Lakers", "Celtics", 4, 0),
		createSportFixture(monthValue, "Basketball", "Basketball League", "Warriors", "Bulls", 12, 1),
		createSportFixture(monthValue, "Basketball", "Basketball League", "Heat", "Nets", 19, 2),
		createSportFixture(monthValue, "Tennis", "ATP / WTA", "Djokovic", "Alcaraz", 5, 1),
		createSportFixture(monthValue, "Tennis", "ATP / WTA", "Swiatek", "Sabalenka", 13, 0),
		createSportFixture(monthValue, "Tennis", "ATP / WTA", "Sinner", "Medvedev", 21, 2)
	];
}

function getDoubleChanceOdds(match: Match) {
	const homeProbability = 1 / match.odds.home;
	const drawProbability = 1 / match.odds.draw;
	const awayProbability = 1 / match.odds.away;
	const margin = 0.93;

	return {
		homeDraw: roundTo2(Math.max(1.03, margin / (homeProbability + drawProbability))),
		drawAway: roundTo2(Math.max(1.03, margin / (drawProbability + awayProbability))),
		homeAway: roundTo2(Math.max(1.03, margin / (homeProbability + awayProbability)))
	};
}

function getGoalMarkets(match: Match) {
	const averagePrice = (match.odds.home + match.odds.draw + match.odds.away) / 3;
	const over = roundTo2(Math.max(1.4, 1.65 + ((averagePrice * 10) % 5) * 0.06));
	const under = roundTo2(Math.max(1.45, over + 0.12));
	const bothTeamsYes = roundTo2(Math.max(1.55, 1.7 + ((averagePrice * 10) % 4) * 0.05));
	const bothTeamsNo = roundTo2(Math.max(1.5, bothTeamsYes + 0.15));

	return {
		over,
		under,
		bothTeamsYes,
		bothTeamsNo
	};
}

const OUTCOME_LABELS: Record<Outcome, string> = {
	home: "HOME",
	draw: "DRAW",
	away: "AWAY",
	homeDraw: "1 OR X",
	drawAway: "X OR 2",
	homeAway: "1 OR 2",
	over25: "OVER",
	under25: "UNDER",
	bttsYes: "YES",
	bttsNo: "NO"
};

function sortMatches(matches: Match[]) {
	return [...matches].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

function SportsbookShell() {
	const [matches, setMatches] = useState<Match[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [liveStatus, setLiveStatus] = useState("Connecting...");
	const [apiOnline, setApiOnline] = useState(true);
	const [apiRetryTick, setApiRetryTick] = useState(0);
	const [activeModule, setActiveModule] = useState<ModuleKey>("highlights");
	const [activeTopNav, setActiveTopNav] = useState<TopNavKey>("sports");
	const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
	const [activeHeroSlide, setActiveHeroSlide] = useState(0);
	const [heroTransitionReady, setHeroTransitionReady] = useState(false);
	const [showSidebar, setShowSidebar] = useState(true);
	const [selectedMonth] = useState(toMonthInputValue);
	const [searchOpen, setSearchOpen] = useState(false);
	const [helpOpen, setHelpOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [clock, setClock] = useState(formatNairobiClock);
	const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(() => {
		const stored = localStorage.getItem("sportpesa_language");
		return stored === "sw" ? "sw" : "en";
	});
	const [showLanguageMenu, setShowLanguageMenu] = useState(false);
	const [authLoading, setAuthLoading] = useState(false);
	const [authError, setAuthError] = useState("");
	const [authMessage, setAuthMessage] = useState("");
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const [registerFullName, setRegisterFullName] = useState("");
	const [registerEmail, setRegisterEmail] = useState("");
	const [registerPhone, setRegisterPhone] = useState("");
	const [registerPassword, setRegisterPassword] = useState("");
	const [showRegisterPanel, setShowRegisterPanel] = useState(false);
	const [accessToken, setAccessToken] = useState(() => localStorage.getItem("sportpesa_access_token") || "");
	const [currentUser, setCurrentUser] = useState<UserProfile | null>(safeReadStoredUser);
	const [activeSelection, setActiveSelection] = useState<Record<string, BetSelection>>({});
	const [stake, setStake] = useState("100");
	const [betCode, setBetCode] = useState("");
	const [panelMessage, setPanelMessage] = useState("");
	const [panelError, setPanelError] = useState("");
	const [placingBet, setPlacingBet] = useState(false);
	const [oddsShortcut, setOddsShortcut] = useState<number | null>(null);
	const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
	const [adminLoading, setAdminLoading] = useState(false);
	const [adminError, setAdminError] = useState("");
	const [adminRefreshTick, setAdminRefreshTick] = useState(0);

	const localFootballMatches = useMemo(() => buildLocalFootballMatches(selectedMonth), [selectedMonth]);
	const extraSportMatches = useMemo(() => buildOtherSportsMatches(selectedMonth), [selectedMonth]);
	const isLoggedIn = Boolean(accessToken && currentUser);
	const isAdmin = currentUser?.role === "admin";

	useEffect(() => {
		localStorage.setItem("sportpesa_language", selectedLanguage);
	}, [selectedLanguage]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			setClock(formatNairobiClock(new Date()));
		}, 1000);

		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		const frameId = window.requestAnimationFrame(() => {
			setHeroTransitionReady(true);
		});

		return () => window.cancelAnimationFrame(frameId);
	}, []);

	useEffect(() => {
		const timer = window.setInterval(() => {
			setActiveHeroSlide((previous) => (previous + 1) % HERO_SLIDES.length);
		}, 6000);

		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		if (!accessToken) {
			return;
		}

		let mounted = true;

		async function syncProfile() {
			try {
				const response = await fetch(`${API_BASE}/users/me`, {
					headers: {
						Authorization: `Bearer ${accessToken}`
					}
				});

				const data = await parseJsonSafely(response);
				if (!response.ok) {
					throw new Error(getPayloadString(data, "error") || "Session expired");
				}

				if (!mounted || !isUserProfile(data?.profile)) {
					return;
				}

				setCurrentUser(data.profile);
				localStorage.setItem("sportpesa_user", JSON.stringify(data.profile));
			} catch {
				if (!mounted) {
					return;
				}

				setAccessToken("");
				setCurrentUser(null);
				localStorage.removeItem("sportpesa_access_token");
				localStorage.removeItem("sportpesa_user");
			}
		}

		void syncProfile();

		return () => {
			mounted = false;
		};
	}, [accessToken]);

	useEffect(() => {
		let mounted = true;
		const monthWindow = getMonthWindow(selectedMonth);
		const params = new URLSearchParams({
			from: monthWindow.from,
			to: monthWindow.to,
			limit: "240"
		});
		const queryString = params.toString();

		async function checkApiOnline() {
			const healthPaths = [`${API_BASE}/health`, "/api/health", "/health"];

			for (const path of healthPaths) {
				try {
					const response = await fetch(path);
					if (response.ok) {
						if (mounted) {
							setApiOnline(true);
						}
						return true;
					}
				} catch {
					// Try the next health route.
				}
			}

			if (mounted) {
				setApiOnline(false);
			}

			return false;
		}

		async function loadMatches() {
			try {
				setLoading(true);
				await checkApiOnline();
				const footballResponse = await fetch(`${API_BASE}/football/matches?${queryString}`);
				const footballData = await footballResponse.json();

				if (!footballResponse.ok) {
					throw new Error(String(footballData?.error || "Football endpoint failed"));
				}

				if (!mounted) {
					return;
				}

				const footballMatches = Array.isArray(footballData.matches)
					? (footballData.matches as Match[]).map((match) => ({ ...match, sport: "Football" }))
					: [];

				setMatches(footballMatches);
				setError("");
				setLiveStatus(describeFootballFeed(String(footballData.source || ""), Boolean(footballData.live)));
			} catch {
				try {
					const fallbackResponse = await fetch(`${API_BASE}/matches?${queryString}`);
					const fallbackData = await fallbackResponse.json();

					if (!fallbackResponse.ok) {
						throw new Error(String(fallbackData?.error || "Fallback endpoint failed"));
					}

					if (!mounted) {
						return;
					}

					const fallbackMatches = Array.isArray(fallbackData.matches)
						? (fallbackData.matches as Match[]).map((match) => ({ ...match, sport: "Football" }))
						: [];

					setMatches(fallbackMatches);
					setError("");
					setLiveStatus(describeFootballFeed(String(fallbackData.source || ""), Boolean(fallbackData.live)));
				} catch {
					if (!mounted) {
						return;
					}

					setApiOnline(false);
					setMatches(localFootballMatches);
					setError("API unavailable. Showing local football fixtures and odds.");
					setLiveStatus("Offline mode: local fixtures loaded");
				}
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		}

		void loadMatches();

		return () => {
			mounted = false;
		};
	}, [apiRetryTick, localFootballMatches, selectedMonth]);

	useEffect(() => {
		let mounted = true;

		async function probeApiHealth() {
			const healthPaths = [`${API_BASE}/health`, "/api/health", "/health"];
			let healthy = false;

			for (const path of healthPaths) {
				try {
					const response = await fetch(path);
					if (response.ok) {
						healthy = true;
						break;
					}
				} catch {
					// Keep checking other endpoints.
				}
			}

			if (!mounted) {
				return;
			}

			if (healthy && !apiOnline) {
				setApiOnline(true);
				setApiRetryTick((previous) => previous + 1);
				setError("");
				setLiveStatus("API reconnected. Loading live fixtures...");
			}

			if (!healthy && apiOnline) {
				setApiOnline(false);
			}
		}

		void probeApiHealth();
		const intervalId = window.setInterval(() => {
			void probeApiHealth();
		}, 12000);

		return () => {
			mounted = false;
			window.clearInterval(intervalId);
		};
	}, [apiOnline]);

	useEffect(() => {
		if (!apiOnline) {
			setLiveStatus("API offline. Using local sportsbook view");
			return;
		}

		let mounted = true;
		const monthWindow = getMonthWindow(selectedMonth);
		const params = new URLSearchParams({
			from: monthWindow.from,
			to: monthWindow.to,
			limit: "240"
		});
		const queryString = params.toString();

		async function refreshFootballOdds() {
			try {
				const response = await fetch(`${API_BASE}/football/odds?${queryString}`);
				const data = await response.json();

				if (!response.ok || !mounted || !Array.isArray(data.odds)) {
					return;
				}

				setMatches((previous) => {
					const byId = new Map<string, Record<MatchOutcome, number>>();

					for (const entry of data.odds as Array<{ matchId?: string; odds?: Partial<Record<MatchOutcome, number>> }>) {
						if (!entry.matchId || !entry.odds) {
							continue;
						}

						const home = Number(entry.odds.home);
						const draw = Number(entry.odds.draw);
						const away = Number(entry.odds.away);

						if (!Number.isFinite(home) || !Number.isFinite(draw) || !Number.isFinite(away)) {
							continue;
						}

						byId.set(entry.matchId, { home, draw, away });
					}

					return previous.map((match) => {
						const updated = byId.get(match.id);
						return updated ? { ...match, odds: updated } : match;
					});
				});

				setLiveStatus(data.live ? "Live football odds updating" : describeFootballFeed(String(data.source || ""), Boolean(data.live)));
			} catch {
				setLiveStatus("Unable to reach odds feed");
			}
		}

		void refreshFootballOdds();
		const pollId = window.setInterval(() => {
			void refreshFootballOdds();
		}, 15000);

		const socket: Socket = io(SOCKET_BASE, {
			transports: ["websocket"],
			query: {
				from: monthWindow.from,
				to: monthWindow.to,
				limit: "240"
			}
		});

		socket.on("connect", () => {
			setLiveStatus("Live odds connected");
		});

		socket.on("disconnect", () => {
			setLiveStatus("Live feed disconnected");
		});

		socket.on("odds:snapshot", (payload: LiveFeedPayload) => {
			if (!Array.isArray(payload.matches)) {
				return;
			}

			setMatches(payload.matches.map((match) => ({ ...match, sport: "Football" })));
			setLiveStatus(describeFootballFeed(payload.source, payload.live));
		});

		socket.on("odds:update", (payload: LiveFeedPayload) => {
			if (!Array.isArray(payload.matches)) {
				return;
			}

			setMatches(payload.matches.map((match) => ({ ...match, sport: "Football" })));
			setLiveStatus(payload.live ? "Live football odds updating" : describeFootballFeed(payload.source, payload.live));
		});

		socket.on("connect_error", () => {
			setLiveStatus("Live socket unavailable");
		});

		return () => {
			mounted = false;
			window.clearInterval(pollId);
			socket.disconnect();
		};
	}, [apiOnline, selectedMonth]);

	useEffect(() => {
		if (activeTopNav === "liveGames") {
			setActiveModule("today");
		}
	}, [activeTopNav]);

	useEffect(() => {
		if (!accessToken || !isAdmin) {
			setAdminOverview(null);
			setAdminError("");
			setAdminLoading(false);
			return;
		}

		let mounted = true;

		async function loadAdminOverview() {
			setAdminLoading(true);
			setAdminError("");

			try {
				const response = await fetch(`${API_BASE}/admin/overview`, {
					headers: {
						Authorization: `Bearer ${accessToken}`
					}
				});

				const data = await parseJsonSafely(response);
				if (!response.ok) {
					throw new Error(getPayloadString(data, "error") || `Failed to load admin overview (${response.status})`);
				}

				const overview = data?.overview as AdminOverview | undefined;
				if (!mounted || !overview) {
					return;
				}

				setAdminOverview(overview);
			} catch (requestError) {
				if (!mounted) {
					return;
				}

				setAdminError(requestError instanceof Error ? requestError.message : "Failed to load admin overview");
			} finally {
				if (mounted) {
					setAdminLoading(false);
				}
			}
		}

		void loadAdminOverview();

		return () => {
			mounted = false;
		};
	}, [API_BASE, accessToken, adminRefreshTick, isAdmin]);

	const mainMatches = useMemo(() => {
		const todayStart = startOfTodayUtc();
		const footballMatches = sortMatches(matches.filter((match) => match.sport === "Football" && isCurrentOrFutureMatch(match, todayStart)));
		const todayKey = matchDateKey(todayStart.toISOString());

		switch (activeModule) {
			case "highlights":
				return footballMatches.filter(
					(match) => HIGHLIGHT_TEAMS.has(match.homeTeam) || HIGHLIGHT_TEAMS.has(match.awayTeam)
				);
			case "popular":
				return footballMatches;
			case "goalRush":
				return footballMatches.filter((match) => match.odds.home + match.odds.draw + match.odds.away >= 8.4);
			case "top5":
				return footballMatches.filter((match) => TOP_LEAGUES.has(match.league));
			case "countries":
				return footballMatches;
			case "today":
				return footballMatches.filter((match) => matchDateKey(match.startTime) === todayKey);
			case "upcoming":
				return footballMatches;
			case "efootball":
				return sortMatches(extraSportMatches.filter((match) => match.sport === "eFootball"));
			case "basketball":
				return sortMatches(extraSportMatches.filter((match) => match.sport === "Basketball"));
			case "tennis":
				return sortMatches(extraSportMatches.filter((match) => match.sport === "Tennis"));
			default:
				return footballMatches;
		}
	}, [activeModule, extraSportMatches, matches]);

	const filteredMatches = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		let next = mainMatches;

		if (query) {
			next = next.filter((match) =>
				`${match.homeTeam} ${match.awayTeam} ${match.league} ${match.sport}`.toLowerCase().includes(query)
			);
		}

		if (oddsShortcut !== null) {
			next = next.filter((match) => Math.min(match.odds.home, match.odds.draw, match.odds.away) <= oddsShortcut);
		}

		return next.slice(0, 14);
	}, [mainMatches, oddsShortcut, searchQuery]);

	const betslip = useMemo(() => Object.values(activeSelection), [activeSelection]);

	const combinedOdds = useMemo(() => {
		if (!betslip.length) {
			return 0;
		}

		return roundTo2(betslip.reduce((total, selection) => total * selection.odd, 1));
	}, [betslip]);

	const potentialWin = useMemo(() => {
		const parsedStake = Number(stake);
		if (!parsedStake || !combinedOdds) {
			return 0;
		}

		return roundTo2(parsedStake * combinedOdds);
	}, [combinedOdds, stake]);

	const moduleLabel =
		[...FOOTBALL_MENU_ITEMS, ...EXTRA_SPORT_MENU_ITEMS].find((item) => item.key === activeModule)?.label || "Football";

	function updateStoredUser(user: UserProfile) {
		setCurrentUser(user);
		localStorage.setItem("sportpesa_user", JSON.stringify(user));
	}

	function clearFeedback() {
		setPanelError("");
		setPanelMessage("");
	}

	function toggleSelection(
		match: Match,
		outcome: Outcome,
		odd: number,
		outcomeLabel: string,
		apiOutcome: MatchOutcome | null = null
	) {
		clearFeedback();
		setActiveSelection((previous) => {
			const existing = previous[match.id];

			if (existing?.outcome === outcome) {
				const copy = { ...previous };
				delete copy[match.id];
				return copy;
			}

			return {
				...previous,
				[match.id]: {
					matchId: match.id,
					outcome,
					apiOutcome,
					outcomeLabel,
					odd,
					label: `${match.homeTeam} vs ${match.awayTeam}`
				}
			};
		});
	}

	function handleTopNavClick(key: TopNavKey) {
		setActiveTopNav(key);
		setSearchOpen(false);
		setHelpOpen(false);
		clearFeedback();
	}

	function handleModuleChange(moduleKey: ModuleKey) {
		setActiveModule(moduleKey);
		setActiveTopNav(moduleKey === "today" ? "liveGames" : "sports");
		clearFeedback();
	}

	function handleLanguageSelect(language: LanguageCode) {
		setSelectedLanguage(language);
		setShowLanguageMenu(false);
		setAuthMessage(language === "sw" ? "Lugha imebadilishwa kuwa Kiswahili." : "Language switched to English.");
		setAuthError("");
	}

	async function handleRegister(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAuthLoading(true);
		setAuthError("");
		setAuthMessage("");

		try {
			const response = await fetch(`${API_BASE}/auth/signup`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					fullName: registerFullName,
					email: registerEmail || undefined,
					phoneNumber: registerPhone || undefined,
					password: registerPassword
				})
			});

			const data = await parseJsonSafely(response);
			if (!response.ok) {
				throw new Error(getPayloadString(data, "error") || `Registration failed (${response.status})`);
			}

			const token = getPayloadString(data, "accessToken") || getPayloadString(data, "token");
			if (token) {
				setAccessToken(token);
				localStorage.setItem("sportpesa_access_token", token);
			}

			if (isUserProfile(data?.user)) {
				updateStoredUser(data.user);
			}

			setShowRegisterPanel(false);
			setRegisterFullName("");
			setRegisterEmail("");
			setRegisterPhone("");
			setRegisterPassword("");
			setAuthMessage("Registration successful. You are now logged in.");
		} catch (requestError) {
			setAuthError(requestError instanceof Error ? requestError.message : "Registration failed");
		} finally {
			setAuthLoading(false);
		}
	}

	async function handleLogin(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setAuthLoading(true);
		setAuthError("");
		setAuthMessage("");

		try {
			const response = await fetch(`${API_BASE}/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					identifier,
					password
				})
			});

			const data = await parseJsonSafely(response);
			if (!response.ok) {
				throw new Error(getPayloadString(data, "error") || `Login failed (${response.status})`);
			}

			const token = getPayloadString(data, "accessToken") || getPayloadString(data, "token");
			if (token) {
				setAccessToken(token);
				localStorage.setItem("sportpesa_access_token", token);
			}

			if (isUserProfile(data?.user)) {
				updateStoredUser(data.user);
			}

			setPassword("");
			setAuthMessage("Login successful.");
		} catch (requestError) {
			setAuthError(requestError instanceof Error ? requestError.message : "Login failed");
		} finally {
			setAuthLoading(false);
		}
	}

	function handleLogout() {
		setAccessToken("");
		setCurrentUser(null);
		setActiveSelection({});
		setStake("100");
		setPanelMessage("");
		setPanelError("");
		setAuthMessage("Logged out successfully.");
		setAuthError("");
		localStorage.removeItem("sportpesa_access_token");
		localStorage.removeItem("sportpesa_user");
	}

	async function handlePlaceBet() {
		clearFeedback();

		if (!accessToken) {
			setPanelError("Please log in using the top bar before placing a bet.");
			return;
		}

		if (!apiOnline) {
			setPanelError("Bet placement is disabled while the API is offline.");
			return;
		}

		if (!betslip.length) {
			setPanelError("Select at least one match first.");
			return;
		}

		if (betslip.some((selection) => !selection.apiOutcome)) {
			setPanelError("Double Chance, Over/Under 2.5, and BTTS are selectable but currently not supported for placement. Use HOME, DRAW, or AWAY.");
			return;
		}

		const parsedStake = Number(stake);
		if (!parsedStake || parsedStake <= 0) {
			setPanelError("Enter a valid stake amount.");
			return;
		}

		setPlacingBet(true);

		try {
			const response = await fetch(`${API_BASE}/bets`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					stake: parsedStake,
					selections: betslip.map((selection) => ({
						matchId: selection.matchId,
						predictedOutcome: selection.apiOutcome
					}))
				})
			});

			const data = await parseJsonSafely(response);
			if (!response.ok) {
				throw new Error(getPayloadString(data, "error") || `Bet placement failed (${response.status})`);
			}

			const nextBalance = Number(data?.balance);
			if (currentUser && Number.isFinite(nextBalance)) {
				updateStoredUser({
					...currentUser,
					balance: nextBalance
				});
			}

			setActiveSelection({});
			setStake("100");
			setPanelMessage(getPayloadString(data, "message") || "Bet placed successfully.");
		} catch (requestError) {
			setPanelError(requestError instanceof Error ? requestError.message : "Bet placement failed");
		} finally {
			setPlacingBet(false);
		}
	}

	function handleBetCodeSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		clearFeedback();

		if (!betCode.trim()) {
			setPanelError("Enter a bet code first.");
			return;
		}

		setPanelMessage(`Bet code ${betCode.trim()} captured. Shared bet-code import is not wired to the backend yet.`);
		setBetCode("");
	}

	function goToPrevSlide() {
		setActiveHeroSlide((previous) => (previous - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
	}

	function goToNextSlide() {
		setActiveHeroSlide((previous) => (previous + 1) % HERO_SLIDES.length);
	}

	return (
		<div className="page-shell">
			<header className="masthead">
				<div className="brand-lockup">
					<h1>SportPesa</h1>
					<span className="country-pill">KENYA</span>
				</div>

				<div className="auth-stage">
					<div className="language-row">
						<button
							type="button"
							className="language-trigger"
							onClick={() => setShowLanguageMenu((previous) => !previous)}
						>
							Language
						</button>
						{showLanguageMenu && (
							<div className="language-menu">
								<button type="button" onClick={() => handleLanguageSelect("en")}>
									English
								</button>
								<button type="button" onClick={() => handleLanguageSelect("sw")}>
									Kiswahili
								</button>
							</div>
						)}
					</div>

					{!isLoggedIn ? (
						<>
							<form className="top-login-form" onSubmit={handleLogin}>
								<label className="sr-only" htmlFor="top-mobile">
									Mobile
								</label>
								<div className="field-shell">
									<span className="field-icon">M</span>
									<input
										id="top-mobile"
										type="text"
										placeholder="Mobile"
										value={identifier}
										onChange={(event) => setIdentifier(event.target.value)}
										required
									/>
								</div>

								<label className="sr-only" htmlFor="top-password">
									Password
								</label>
								<div className="field-shell">
									<span className="field-icon">P</span>
									<input
										id="top-password"
										type="password"
										placeholder="Password"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										required
									/>
								</div>

								<button type="submit" className="login-button" disabled={authLoading}>
									{authLoading ? "..." : "LOGIN"}
								</button>

								<button
									type="button"
									className="register-button"
									onClick={() => {
										setShowRegisterPanel((previous) => !previous);
										setAuthError("");
										setAuthMessage("");
									}}
								>
									REGISTER
								</button>
							</form>

							<p className="auth-assist">Already using SportPesa via SMS or USSD? - Forgot your password?</p>
						</>
					) : (
						<>
							<div className="session-banner">
								<div>
									<span>Logged in as</span>
									<strong>{currentUser?.fullName}</strong>
								</div>
								<div>
									<span>Balance</span>
									<strong>KES {currentUser ? currentUser.balance.toFixed(2) : "0.00"}</strong>
								</div>
								<button type="button" onClick={handleLogout}>
									LOGOUT
								</button>
							</div>

							<p className="auth-assist">Your account is ready. Select matches below to add them to the betslip.</p>
						</>
					)}

					{showRegisterPanel && !isLoggedIn && (
						<form className="register-panel" onSubmit={handleRegister}>
							<input
								type="text"
								placeholder="Full name"
								value={registerFullName}
								onChange={(event) => setRegisterFullName(event.target.value)}
								required
							/>
							<input
								type="email"
								placeholder="Email"
								value={registerEmail}
								onChange={(event) => setRegisterEmail(event.target.value)}
							/>
							<input
								type="tel"
								placeholder="Phone number"
								value={registerPhone}
								onChange={(event) => setRegisterPhone(event.target.value)}
							/>
							<input
								type="password"
								placeholder="Create password"
								value={registerPassword}
								onChange={(event) => setRegisterPassword(event.target.value)}
								minLength={6}
								required
							/>
							<button type="submit" disabled={authLoading}>
								{authLoading ? "Creating..." : "Create Account"}
							</button>
						</form>
					)}

					{authError && <p className="top-message error">{authError}</p>}
					{authMessage && <p className="top-message success">{authMessage}</p>}
				</div>
			</header>

			{isAdmin && (
				<section className="admin-dashboard-shell" aria-label="Admin dashboard">
					<div className="admin-dashboard-header">
						<h2>Admin Dashboard</h2>
						<button type="button" onClick={() => setAdminRefreshTick((previous) => previous + 1)} disabled={adminLoading}>
							{adminLoading ? "Refreshing..." : "Refresh"}
						</button>
					</div>

					{adminError && <p className="admin-dashboard-message error">{adminError}</p>}

					<div className="admin-dashboard-grid">
						<article className="admin-stat-card">
							<span>Users</span>
							<strong>{adminOverview?.users ?? 0}</strong>
						</article>
						<article className="admin-stat-card">
							<span>Total Bets</span>
							<strong>{adminOverview?.bets ?? 0}</strong>
						</article>
						<article className="admin-stat-card">
							<span>Pending Bets</span>
							<strong>{adminOverview?.pendingBets ?? 0}</strong>
						</article>
						<article className="admin-stat-card">
							<span>Won Bets</span>
							<strong>{adminOverview?.wonBets ?? 0}</strong>
						</article>
						<article className="admin-stat-card">
							<span>Payouts</span>
							<strong>{adminOverview?.payouts ?? 0}</strong>
						</article>
						<article className="admin-stat-card">
							<span>Matches</span>
							<strong>{adminOverview?.matches ?? 0}</strong>
						</article>
					</div>

					<p className="admin-dashboard-note">Admin account detected. Use this dashboard to monitor platform activity in real time.</p>
				</section>
			)}

			<nav className="product-nav">
				<div className="nav-list" role="tablist" aria-label="SportPesa products">
					{TOP_NAV_ITEMS.map((item) => (
						<button
							type="button"
							key={item.key}
							className={`nav-link ${activeTopNav === item.key ? "active" : ""}`}
							onClick={() => handleTopNavClick(item.key)}
						>
							<span>{item.label}</span>
							{item.badge && <em className="nav-badge">{item.badge}</em>}
							{typeof item.count === "number" && <em className="nav-count">{item.count}</em>}
							{item.hasCaret && <em className="nav-caret">v</em>}
						</button>
					))}
				</div>

				<div className="nav-tools">
					<button
						type="button"
						className={`nav-tool ${searchOpen ? "active" : ""}`}
						onClick={() => setSearchOpen((previous) => !previous)}
					>
						Search
					</button>
					<button
						type="button"
						className={`nav-tool ${helpOpen ? "active" : ""}`}
						onClick={() => setHelpOpen((previous) => !previous)}
					>
						Help
					</button>
					<span className="clock-chip">{clock}</span>
				</div>
			</nav>

			{(searchOpen || helpOpen) && (
				<section className="utility-drawer">
					{searchOpen && (
						<div className="drawer-card">
							<h2>Search Matches</h2>
							<input
								type="text"
								placeholder="Search team, league or sport"
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
							/>
							<p>Search is applied instantly to the sportsbook table.</p>
						</div>
					)}

					{helpOpen && (
						<div className="drawer-card">
							<h2>Help</h2>
							<p>Use the top login bar to sign in, click any 1/X/2 odd to build a betslip, then place your bet from the right rail.</p>
							<p>Customer care: 0755 079 079</p>
							<p>SMS registration: send GAME to 79079</p>
						</div>
					)}
				</section>
			)}

			<main className={`content-grid ${showSidebar ? "" : "sidebar-collapsed"}`}>
				{showSidebar ? (
					<aside className="left-rail">
						<button type="button" className="hide-toggle" onClick={() => setShowSidebar(false)}>
							&lt;&lt; Hide
						</button>

						{/* Football Menu Items */}
						<section className="rail-section">
							<div className="rail-links">
								{FOOTBALL_MENU_ITEMS.map((item) => (
									<button
										type="button"
										key={item.key}
										className={`rail-link ${activeModule === item.key ? "active" : ""}`}
										onClick={() => handleModuleChange(item.key)}
									>
										{item.label}
									</button>
								))}
							</div>
						</section>

						{/* Top 5 Leagues Section */}
						{activeModule === "top5" && (
							<section className="rail-section leagues-section">
								<header className="rail-title">Top 5 Leagues</header>
								<div className="leagues-list">
									{TOP_LEAGUES_WITH_FLAGS.map((league) => (
										<div key={league.name}>
											<button
												type="button"
												className={`league-item ${selectedLeague === league.name ? "expanded" : ""}`}
												onClick={() => setSelectedLeague(selectedLeague === league.name ? null : league.name)}
											>
												<span className="league-flag">{league.flag}</span>
												<span className="league-name">{league.name}</span>
												<span className="league-toggle">{selectedLeague === league.name ? "▼" : "▶"}</span>
											</button>
											{selectedLeague === league.name && (
												<div className="countries-list">
													{league.countries.map((country) => (
														<button
															type="button"
															key={country.name}
															className="country-item"
														>
															<span className="country-flag">{country.flag}</span>
															<span className="country-name">{country.name}</span>
														</button>
													))}
												</div>
											)}
										</div>
									))}
								</div>
							</section>
						)}

						{/* Other Sports */}
						<section className="rail-section other-sports-section">
							{EXTRA_SPORT_MENU_ITEMS.map((item) => (
								<button
									type="button"
									key={`${item.label}-${item.icon}`}
									className={`rail-link sport-link ${activeModule === item.key ? "active" : ""}`}
									onClick={() => handleModuleChange(item.key)}
								>
									<span className="sport-icon">{item.icon}</span>
									<span>{item.label}</span>
								</button>
							))}
						</section>

						{/* Favorites Section */}
						<section className="rail-section favorites-section">
							<header className="rail-title">❤️ Favorites</header>
							<div className="favorites-banner">
								<p className="favorites-message">Login or register to save your favorites</p>
								{!isLoggedIn ? (
									<div className="favorites-buttons">
										<button
											type="button"
											className="favorites-btn join-btn"
											onClick={() => {
												setShowRegisterPanel((previous) => !previous);
												setAuthError("");
												setAuthMessage("");
											}}
										>
											JOIN US
										</button>
										<button
											type="button"
											className="favorites-btn login-btn"
											onClick={() => setShowRegisterPanel(false)}
										>
											LOGIN
										</button>
									</div>
								) : (
									<p className="user-welcome">Welcome, {currentUser?.fullName}!</p>
								)}
							</div>
						</section>
					</aside>
				) : (
					<button type="button" className="show-sidebar" onClick={() => setShowSidebar(true)}>
						Show Menu
					</button>
				)}

				<section className="center-stage">
					<div className={`hero-carousel ${heroTransitionReady ? "ready" : ""}`}>
						{HERO_SLIDES.map((slide, index) => (
							<img
								key={slide.id}
								className={`hero-slide ${index === activeHeroSlide ? "active" : ""}`}
								src={slide.image}
								alt={slide.alt}
							/>
						))}

						<button type="button" className="hero-arrow left" onClick={goToPrevSlide}>
							&lt;
						</button>
						<button type="button" className="hero-arrow right" onClick={goToNextSlide}>
							&gt;
						</button>

						<div className="hero-dots">
							{HERO_SLIDES.map((slide, index) => (
								<button
									type="button"
									key={slide.id}
									className={`hero-dot ${index === activeHeroSlide ? "active" : ""}`}
									onClick={() => setActiveHeroSlide(index)}
									aria-label={`Open slide ${index + 1}`}
								/>
							))}
						</div>
					</div>

					<section className="odds-board">
						<header className="board-header">
							<div className="board-emblem">o</div>
							<h2>{`${moduleLabel.toUpperCase()} BETTING ODDS`}</h2>
							<div className="board-icons" aria-label="board actions">
								<button type="button">P</button>
								<button type="button">C</button>
								<button type="button">?</button>
							</div>
						</header>

						<div className="board-controls">
							<span>Show odds:</span>
							{[1.2, 1.5, 1.8].map((shortcut) => (
								<button
									type="button"
									key={shortcut}
									className={`shortcut-chip ${oddsShortcut === shortcut ? "active" : ""}`}
									onClick={() => setOddsShortcut((previous) => (previous === shortcut ? null : shortcut))}
								>
									{`Under ${shortcut.toFixed(2)}`}
								</button>
							))}
							{oddsShortcut !== null && (
								<button type="button" className="shortcut-reset" onClick={() => setOddsShortcut(null)}>
									All
								</button>
							)}
						</div>

						<div className="board-status">
							<strong>{activeTopNav === "liveGames" ? "Live Games" : "Sportsbook"}</strong>
							<span>{liveStatus}</span>
						</div>

						{error && <p className="board-feedback error">{error}</p>}
						{loading && <p className="board-feedback">Loading matches...</p>}
						{!loading && !filteredMatches.length && <p className="board-feedback">No matches available for the selected view.</p>}

						{!loading && !!filteredMatches.length && (
							<div className="odds-table-scroll">
								<div className="odds-grid group-headings">
									<div className="match-heading">Fixtures</div>
									<div className="group-title" style={{ gridColumn: "2 / span 3" }}>
										3 WAY
									</div>
									<div className="group-title" style={{ gridColumn: "5 / span 3" }}>
										DOUBLE CHANCE
									</div>
									<div className="group-title" style={{ gridColumn: "8 / span 2" }}>
										OVER/UNDER 2.5
									</div>
									<div className="group-title" style={{ gridColumn: "10 / span 2" }}>
										BOTH TEAMS TO SCORE
									</div>
								</div>

								<div className="odds-grid market-headings">
									<div />
									<span>HOME</span>
									<span>DRAW</span>
									<span>AWAY</span>
									<span>1 OR X</span>
									<span>X OR 2</span>
									<span>1 OR 2</span>
									<span>OVER</span>
									<span>UNDER</span>
									<span>YES</span>
									<span>NO</span>
								</div>

								{filteredMatches.map((match) => {
									const doubleChance = getDoubleChanceOdds(match);
									const goalMarkets = getGoalMarkets(match);

									return (
										<div className="odds-grid match-row" key={match.id}>
											<div className="fixture-cell">
												<small>{`${formatKickoff(match.startTime)} | ${match.league}`}</small>
												<strong>{match.homeTeam}</strong>
												<strong>{match.awayTeam}</strong>
											</div>

											{(["home", "draw", "away"] as MatchOutcome[]).map((outcome) => (
												<button
													type="button"
													key={outcome}
													className={`market-button ${activeSelection[match.id]?.outcome === outcome ? "active" : ""}`}
													onClick={() => toggleSelection(match, outcome, match.odds[outcome], OUTCOME_LABELS[outcome], outcome)}
												>
													{match.odds[outcome].toFixed(2)}
												</button>
											))}

													<button
														type="button"
														className={`market-button ${activeSelection[match.id]?.outcome === "homeDraw" ? "active" : ""}`}
														onClick={() => toggleSelection(match, "homeDraw", doubleChance.homeDraw, OUTCOME_LABELS.homeDraw)}
													>
														{doubleChance.homeDraw.toFixed(2)}
													</button>
													<button
														type="button"
														className={`market-button ${activeSelection[match.id]?.outcome === "drawAway" ? "active" : ""}`}
														onClick={() => toggleSelection(match, "drawAway", doubleChance.drawAway, OUTCOME_LABELS.drawAway)}
													>
														{doubleChance.drawAway.toFixed(2)}
													</button>
													<button
														type="button"
														className={`market-button ${activeSelection[match.id]?.outcome === "homeAway" ? "active" : ""}`}
														onClick={() => toggleSelection(match, "homeAway", doubleChance.homeAway, OUTCOME_LABELS.homeAway)}
													>
														{doubleChance.homeAway.toFixed(2)}
													</button>
													<button
														type="button"
														className={`market-button ${activeSelection[match.id]?.outcome === "over25" ? "active" : ""}`}
														onClick={() => toggleSelection(match, "over25", goalMarkets.over, OUTCOME_LABELS.over25)}
													>
														{goalMarkets.over.toFixed(2)}
													</button>
													<button
														type="button"
														className={`market-button ${activeSelection[match.id]?.outcome === "under25" ? "active" : ""}`}
														onClick={() => toggleSelection(match, "under25", goalMarkets.under, OUTCOME_LABELS.under25)}
													>
														{goalMarkets.under.toFixed(2)}
													</button>
													<button
														type="button"
														className={`market-button ${activeSelection[match.id]?.outcome === "bttsYes" ? "active" : ""}`}
														onClick={() => toggleSelection(match, "bttsYes", goalMarkets.bothTeamsYes, OUTCOME_LABELS.bttsYes)}
													>
														{goalMarkets.bothTeamsYes.toFixed(2)}
													</button>
													<button
														type="button"
														className={`market-button ${activeSelection[match.id]?.outcome === "bttsNo" ? "active" : ""}`}
														onClick={() => toggleSelection(match, "bttsNo", goalMarkets.bothTeamsNo, OUTCOME_LABELS.bttsNo)}
													>
														{goalMarkets.bothTeamsNo.toFixed(2)}
													</button>
										</div>
									);
								})}
							</div>
						)}
					</section>
				</section>

				<aside className="right-rail">
					<section className="rail-card">
						<header className="rail-card-header">
							<h3>BETSLIP</h3>
							<button type="button" className="rail-card-menu">
								...
							</button>
						</header>

						<div className="rail-card-body">
							{isLoggedIn && currentUser && (
								<div className="wallet-banner">
									<span>Wallet balance</span>
									<strong>KES {currentUser.balance.toFixed(2)}</strong>
								</div>
							)}

							{!betslip.length ? (
								<div className="empty-slip">
									<div className="empty-slip-icon" aria-hidden="true">
										<span />
										<span />
										<span />
									</div>
									<h4>You have not selected any bet</h4>
									<p>Make your first pick to start playing.</p>
								</div>
							) : (
								<div className="slip-list">
									{betslip.map((selection) => (
										<article key={selection.matchId} className="slip-item">
											<h4>{selection.label}</h4>
											<p>{`${selection.outcomeLabel} @ ${selection.odd.toFixed(2)}`}</p>
										</article>
									))}
								</div>
							)}

							<form className="bet-code-form" onSubmit={handleBetCodeSubmit}>
								<label htmlFor="bet-code">Or introduce your bet code:</label>
								<div className="bet-code-row">
									<input
										id="bet-code"
										type="text"
										placeholder="Bet code"
										value={betCode}
										onChange={(event) => setBetCode(event.target.value)}
									/>
									<button type="submit">ADD</button>
								</div>
							</form>

							{!!betslip.length && (
								<div className="stake-panel">
									<label htmlFor="stake">Stake</label>
									<input
										id="stake"
										type="number"
										min="1"
										value={stake}
										onChange={(event) => setStake(event.target.value)}
									/>

									<div className="summary-row">
										<span>Combined odds</span>
										<strong>{combinedOdds.toFixed(2)}</strong>
									</div>
									<div className="summary-row">
										<span>Potential win</span>
										<strong>KES {potentialWin.toFixed(2)}</strong>
									</div>

									<button
										type="button"
										className="place-bet-button"
										onClick={handlePlaceBet}
										disabled={placingBet || !isLoggedIn || !apiOnline}
									>
										{placingBet ? "Placing..." : "PLACE BET"}
									</button>
								</div>
							)}

							{!isLoggedIn && <p className="rail-note">Log in from the top bar to place bets and use your wallet.</p>}
							{panelError && <p className="rail-message error">{panelError}</p>}
							{panelMessage && <p className="rail-message success">{panelMessage}</p>}
						</div>
					</section>

					<section className="rail-card paybill-card">
						<header className="paybill-header">
							<h3>PAYBILL NUMBERS</h3>
						</header>
						<div className="rail-card-body">
							<p>Your account/reference number should be your registered number.</p>

							<div className="paybill-list">
								{PAYBILL_INFO.map((item) => (
									<div className="paybill-row" key={item.label}>
										<span>{item.label}</span>
										<strong>{item.value}</strong>
									</div>
								))}
							</div>
						</div>
					</section>

					<section className="rail-card customer-care-card">
						<header className="paybill-header">
							<h3>CUSTOMER CARE</h3>
						</header>
						<div className="rail-card-body compact">
							<p>We offer 24/7 customer care attention to SportPesa players.</p>
							<div className="customer-care-list">
								{CUSTOMER_CARE_CONTACTS.map((contact) => (
									<div className="customer-care-row" key={contact}>
										<strong>{contact}</strong>
									</div>
								))}
							</div>
						</div>
					</section>

					<section className="promo-stack" aria-label="SportPesa promos">
						{RIGHT_RAIL_PROMOS.map((promo) => (
							<article className="promo-banner" key={promo.key}>
								<img src={promo.image} alt={promo.alt} loading="lazy" />
							</article>
						))}
					</section>
				</aside>
			</main>
		</div>
	);
}

export default SportsbookShell;
