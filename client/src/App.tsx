import { useEffect, useMemo, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import "./App.css";

type Outcome = "home" | "draw" | "away";

type Match = {
	id: string;
	homeTeam: string;
	awayTeam: string;
	league: string;
	sport: string;
	startTime: string;
	odds: Record<Outcome, number>;
	status: string;
	result: Outcome | null;
};

type ModuleKey =
	| "highlights"
	| "popular"
	| "goalRush"
	| "top5"
	| "countries"
	| "today"
	| "upcoming"
	| "otherSports"
	| "efootball"
	| "basketball"
	| "tennis"
	| "rugby"
	| "iceHockey"
	| "volleyball"
	| "handball"
	| "cricket"
	| "baseball"
	| "boxing"
	| "mma"
	| "americanFootball";

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

type AdminSignal = {
	userId: string;
	email: string;
	withdrawalCount: number;
	highStakeBets: number;
	reason: string;
};

type AdminBet = {
	id: string;
	userId: string;
	stake: number;
	potentialWin: number;
	status: string;
	paidOut: boolean;
};

type AdminTransaction = {
	id: string;
	userId: string;
	type: string;
	status: string;
	amount: number;
	createdAt: string;
};

type AdminToolKey = "overview" | "users" | "bets" | "fraud" | "transactions" | "results" | "payouts";

type AccountToolKey = "deposit" | "withdraw" | "betHistory" | "transactionHistory" | "settings" | "selfExclusion";

type AccountTransaction = {
	id: string;
	type: string;
	status: string;
	amount: number;
	createdAt: string;
	phoneNumber?: string;
	reference?: string;
};

type MyBet = {
	id: string;
	stake: number;
	combinedOdds: number;
	potentialWin: number;
	status: string;
	paidOut: boolean;
	createdAt: string;
};

type ApiPayload = Record<string, unknown>;

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE || "";

const FOOTBALL_MODULES: Array<{ key: ModuleKey; label: string }> = [
	{ key: "highlights", label: "Highlights" },
	{ key: "popular", label: "Popular Games" },
	{ key: "goalRush", label: "Goal Rush" },
	{ key: "top5", label: "Top 5 Leagues" },
	{ key: "countries", label: "Countries" },
	{ key: "today", label: "Today Games" },
	{ key: "upcoming", label: "Upcoming Games" }
];

const OTHER_SPORT_MODULES: Array<{ key: ModuleKey; label: string }> = [
	{ key: "otherSports", label: "Other Sports" },
	{ key: "efootball", label: "eFootball" },
	{ key: "basketball", label: "Basketball" },
	{ key: "tennis", label: "Tennis" },
	{ key: "rugby", label: "Rugby Union" },
	{ key: "iceHockey", label: "Ice Hockey" },
	{ key: "volleyball", label: "Volleyball" },
	{ key: "handball", label: "Handball" },
	{ key: "cricket", label: "Cricket" },
	{ key: "baseball", label: "Baseball" },
	{ key: "boxing", label: "Boxing" },
	{ key: "mma", label: "MMA" },
	{ key: "americanFootball", label: "American Football" }
];

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

const TOP_NAV_CONTENT: Record<TopNavKey, { heading: string; subtitle: string; cards: string[] }> = {
	sports: {
		heading: "Sportsbook",
		subtitle: "Pre-match and in-play football odds",
		cards: []
	},
	liveGames: {
		heading: "Live Games",
		subtitle: "Live fixtures and fast-moving in-play odds",
		cards: []
	},
	aviator: {
		heading: "Aviator",
		subtitle: "Cash out before the flight flies away",
		cards: ["Round starts every few seconds", "Auto-cashout settings", "Simple risk controls"]
	},
	casino: {
		heading: "Casino",
		subtitle: "Table games and slots in one place",
		cards: ["Blackjack and Roulette", "Instant spins", "Daily bonus drops"]
	},
	virtuals: {
		heading: "Virtuals",
		subtitle: "Fast virtual football and racing action",
		cards: ["Virtual Football", "Instant Keno", "Rapid race markets"]
	},
	jackpots: {
		heading: "Jackpots",
		subtitle: "Multi-level jackpots and pooled prizes",
		cards: ["Mega weekly draws", "Pick-8 style entries", "Low stake, high ceiling"]
	},
	luckyNumbers: {
		heading: "Lucky Numbers",
		subtitle: "Draw-based play with scheduled number drops",
		cards: ["5-min draws", "Auto pick", "Quick results feed"]
	},
	more: {
		heading: "More",
		subtitle: "Extra products and promos",
		cards: ["Lucky Numbers", "Virtuals", "Campaign hub"]
	},
	apps: {
		heading: "Apps",
		subtitle: "Install and play on mobile quickly",
		cards: ["Android app", "Lite web app", "Install guide"]
	}
};

const ADMIN_TOOLS: Array<{ key: AdminToolKey; label: string }> = [
	{ key: "overview", label: "Overview" },
	{ key: "users", label: "Users" },
	{ key: "bets", label: "Bets" },
	{ key: "fraud", label: "Fraud Signals" },
	{ key: "transactions", label: "Transactions" },
	{ key: "results", label: "Results" },
	{ key: "payouts", label: "Payouts" }
];

const ACCOUNT_TOOLS: Array<{ key: AccountToolKey; label: string; icon: string; marker?: string }> = [
	{ key: "deposit", label: "Deposit", icon: "⌄" },
	{ key: "withdraw", label: "Withdraw", icon: "⌃" },
	{ key: "betHistory", label: "Bet History", icon: "◷", marker: "+" },
	{ key: "transactionHistory", label: "Transaction History", icon: "⇅" },
	{ key: "settings", label: "Settings", icon: "⚙" },
	{ key: "selfExclusion", label: "Self Exclusion", icon: "✋" }
];

const HERO_SLIDES: HeroSlide[] = [
	{
		id: "hero-1",
		image: "/hero-slide-1.svg",
		alt: "SportPesa promo banner with football campaign"
	},
	{
		id: "hero-2",
		image: "/hero-slide-2.svg",
		alt: "SportPesa register by SMS campaign banner"
	}
];

const TOP_LEAGUES = new Set(["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"]);
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

function createSportFixture(monthValue: string, sport: string, home: string, away: string, day: number, slot: number): Match {
	const [yearRaw, monthRaw] = monthValue.split("-");
	const year = Number(yearRaw);
	const month = Number(monthRaw);
	const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();
	const safeMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
	const startHour = slot === 0 ? 13 : slot === 1 ? 16 : 20;
	const start = new Date(Date.UTC(safeYear, safeMonth - 1, day, startHour, 15, 0, 0));
	const homeOdd = Number((1.65 + ((day + slot) % 6) * 0.24).toFixed(2));
	const drawOdd = Number((2.95 + ((day + slot + 2) % 5) * 0.21).toFixed(2));
	const awayOdd = Number((1.72 + ((day + slot + 4) % 6) * 0.27).toFixed(2));

	return {
		id: `${sport}-${safeYear}-${safeMonth}-${day}-${slot}-${home}-${away}`,
		homeTeam: home,
		awayTeam: away,
		league: `${sport} League`,
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

function buildOtherSportsMatches(monthValue: string): Match[] {
	return [
		createSportFixture(monthValue, "eFootball", "eArsenal", "eChelsea", 2, 0),
		createSportFixture(monthValue, "eFootball", "eBarcelona", "eReal Madrid", 11, 1),
		createSportFixture(monthValue, "eFootball", "eBayern", "ePSG", 23, 2),
		createSportFixture(monthValue, "Basketball", "Lakers", "Celtics", 3, 0),
		createSportFixture(monthValue, "Basketball", "Bulls", "Warriors", 10, 1),
		createSportFixture(monthValue, "Basketball", "Heat", "Nets", 18, 2),
		createSportFixture(monthValue, "Tennis", "Djokovic", "Alcaraz", 4, 1),
		createSportFixture(monthValue, "Tennis", "Medvedev", "Sinner", 12, 2),
		createSportFixture(monthValue, "Tennis", "Swiatek", "Sabalenka", 20, 0),
		createSportFixture(monthValue, "Rugby Union", "Leinster", "Saracens", 6, 1),
		createSportFixture(monthValue, "Rugby Union", "Sharks", "Stormers", 14, 0),
		createSportFixture(monthValue, "Rugby Union", "Toulouse", "Munster", 22, 2),
		createSportFixture(monthValue, "Ice Hockey", "Bruins", "Maple Leafs", 8, 1),
		createSportFixture(monthValue, "Ice Hockey", "Rangers", "Avalanche", 17, 2),
		createSportFixture(monthValue, "Ice Hockey", "Panthers", "Stars", 25, 0),
		createSportFixture(monthValue, "Volleyball", "Kenya Prisons", "KPA", 5, 0),
		createSportFixture(monthValue, "Volleyball", "APR", "Police VC", 13, 1),
		createSportFixture(monthValue, "Volleyball", "Al Ahly", "Zamalek", 21, 2),
		createSportFixture(monthValue, "Handball", "Barca Handbol", "Veszprem", 9, 0),
		createSportFixture(monthValue, "Handball", "PSG Handball", "Kiel", 15, 2),
		createSportFixture(monthValue, "Handball", "Aalborg", "Magdeburg", 27, 1),
		createSportFixture(monthValue, "Cricket", "India", "Australia", 7, 2),
		createSportFixture(monthValue, "Cricket", "England", "South Africa", 16, 1),
		createSportFixture(monthValue, "Cricket", "Pakistan", "New Zealand", 24, 0),
		createSportFixture(monthValue, "Baseball", "Yankees", "Dodgers", 6, 2),
		createSportFixture(monthValue, "Baseball", "Mets", "Red Sox", 14, 1),
		createSportFixture(monthValue, "Baseball", "Cubs", "Giants", 28, 0),
		createSportFixture(monthValue, "Boxing", "Tyson Fury", "Oleksandr Usyk", 12, 2),
		createSportFixture(monthValue, "Boxing", "Canelo", "Benavidez", 20, 1),
		createSportFixture(monthValue, "Boxing", "Joshua", "Wilder", 29, 0),
		createSportFixture(monthValue, "MMA", "Adesanya", "Whittaker", 9, 2),
		createSportFixture(monthValue, "MMA", "Edwards", "Covington", 19, 1),
		createSportFixture(monthValue, "MMA", "Jones", "Aspinall", 26, 2),
		createSportFixture(monthValue, "American Football", "Chiefs", "49ers", 4, 2),
		createSportFixture(monthValue, "American Football", "Bills", "Cowboys", 18, 0),
		createSportFixture(monthValue, "American Football", "Eagles", "Ravens", 30, 1)
	];
}

function buildLocalFootballMatches(monthValue: string): Match[] {
	const fixtures = [
		["Arsenal", "Chelsea", "Premier League", 2, 0],
		["Liverpool", "Manchester City", "Premier League", 5, 1],
		["Manchester United", "Tottenham", "Premier League", 11, 2],
		["Barcelona", "Atletico Madrid", "La Liga", 3, 1],
		["Real Madrid", "Sevilla", "La Liga", 9, 2],
		["Valencia", "Villarreal", "La Liga", 17, 0],
		["Inter", "AC Milan", "Serie A", 4, 2],
		["Juventus", "Napoli", "Serie A", 13, 0],
		["Roma", "Lazio", "Serie A", 21, 1],
		["Bayern Munich", "Borussia Dortmund", "Bundesliga", 6, 1],
		["Leverkusen", "RB Leipzig", "Bundesliga", 14, 2],
		["PSG", "Marseille", "Ligue 1", 8, 0],
		["Monaco", "Lyon", "Ligue 1", 19, 1],
		["Newcastle", "Brighton", "Premier League", 24, 2],
		["Atletico Madrid", "Real Madrid", "La Liga", 27, 0]
	] as const;

	return fixtures.map(([home, away, league, day, slot]) => ({
		...createSportFixture(monthValue, "Football", home, away, day, slot),
		league
	}));
}

function toMonthInputValue(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

function getMonthRange(monthValue: string) {
	const [yearRaw, monthRaw] = monthValue.split("-");
	const year = Number(yearRaw);
	const month = Number(monthRaw);

	if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
		const now = new Date();
		return getMonthRange(toMonthInputValue(now));
	}

	const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
	const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

	return {
		from: start.toISOString(),
		to: end.toISOString()
	};
}

function buildMonthOptions(rangeMonths = 12) {
	const options: Array<{ value: string; label: string }> = [];
	const now = new Date();

	for (let offset = 0; offset < rangeMonths; offset += 1) {
		const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
		const value = toMonthInputValue(date);
		const label = date.toLocaleDateString("en-KE", {
			month: "long",
			year: "numeric"
		});

		options.push({ value, label });
	}

	return options;
}

function matchDateKey(dateString: string) {
	return dateString.slice(0, 10);
}

function formatKickoff(dateString: string) {
	const date = new Date(dateString);
	return date.toLocaleString("en-KE", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	});
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

function getPayloadString(payload: ApiPayload | null, key: string): string {
	const value = payload?.[key];
	return typeof value === "string" ? value : "";
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

function App() {
	const [matches, setMatches] = useState<Match[]>([]);
	const [loading, setLoading] = useState(true);
	const [authLoading, setAuthLoading] = useState(false);
	const [activeSelection, setActiveSelection] = useState<Record<string, BetSelection>>({});
	const [stake, setStake] = useState("100");
	const [error, setError] = useState("");
	const [liveStatus, setLiveStatus] = useState("Connecting...");
	const [selectedMonth, setSelectedMonth] = useState(toMonthInputValue);
	const [selectedDate, setSelectedDate] = useState("all");
	const [selectedLeague, setSelectedLeague] = useState("all");
	const [activeModule, setActiveModule] = useState<ModuleKey>("highlights");
	const [activeTopNav, setActiveTopNav] = useState<TopNavKey>("sports");
	const [activeHeroSlide, setActiveHeroSlide] = useState(0);
	const [authError, setAuthError] = useState("");
	const [authMessage, setAuthMessage] = useState("");
	const [authMode, setAuthMode] = useState<"login" | "register">("login");
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [phoneNumber, setPhoneNumber] = useState("");
	const [accessToken, setAccessToken] = useState("");
	const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
	const [accountView, setAccountView] = useState(false);
	const [activeAccountTool, setActiveAccountTool] = useState<AccountToolKey>("deposit");
	const [accountLoading, setAccountLoading] = useState(false);
	const [accountError, setAccountError] = useState("");
	const [accountMessage, setAccountMessage] = useState("");
	const [depositAmount, setDepositAmount] = useState("");
	const [depositPhone, setDepositPhone] = useState("");
	const [withdrawAmount, setWithdrawAmount] = useState("");
	const [selfExclusionHours, setSelfExclusionHours] = useState("24");
	const [selfExclusionEnabled, setSelfExclusionEnabled] = useState(false);
	const [accountTransactions, setAccountTransactions] = useState<AccountTransaction[]>([]);
	const [accountBets, setAccountBets] = useState<MyBet[]>([]);
	const [showAdminDashboard, setShowAdminDashboard] = useState(false);
	const [adminLoading, setAdminLoading] = useState(false);
	const [adminError, setAdminError] = useState("");
	const [adminMessage, setAdminMessage] = useState("");
	const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
	const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
	const [adminBets, setAdminBets] = useState<AdminBet[]>([]);
	const [adminSignals, setAdminSignals] = useState<AdminSignal[]>([]);
	const [adminTransactions, setAdminTransactions] = useState<AdminTransaction[]>([]);
	const [activeAdminTool, setActiveAdminTool] = useState<AdminToolKey>("overview");
	const [adminMatchId, setAdminMatchId] = useState("");
	const [adminResult, setAdminResult] = useState<Outcome>("home");
	const [adminPayoutBetId, setAdminPayoutBetId] = useState("");
	const [apiOnline, setApiOnline] = useState(true);
	const isLoggedIn = Boolean(accessToken && currentUser);
	const isAdminUser = currentUser?.role === "admin";
	const monthOptions = useMemo(() => buildMonthOptions(), []);
	const otherSportsMatches = useMemo(() => buildOtherSportsMatches(selectedMonth), [selectedMonth]);
	const localFootballMatches = useMemo(() => buildLocalFootballMatches(selectedMonth), [selectedMonth]);
	const sportsbookView = activeTopNav === "sports" || activeTopNav === "liveGames";
	const adminView = Boolean(showAdminDashboard && isAdminUser);
	const accountWorkspaceView = Boolean(accountView && isLoggedIn && !adminView);
	const wonUnpaidBets = useMemo(
		() => adminBets.filter((bet) => bet.status === "won" && !bet.paidOut),
		[adminBets]
	);
	const resultCandidateMatches = useMemo(
		() => matches.filter((match) => match.sport === "Football").slice(0, 25),
		[matches]
	);

	useEffect(() => {
		const savedToken = localStorage.getItem("sportpesa_access_token") || "";
		const savedUser = localStorage.getItem("sportpesa_user");

		if (savedToken) {
			setAccessToken(savedToken);
		}

		if (savedUser) {
			try {
				const parsedUser = JSON.parse(savedUser) as UserProfile;
				setCurrentUser(parsedUser);
				if (parsedUser.role === "admin") {
					setShowAdminDashboard(true);
				}
			} catch {
				localStorage.removeItem("sportpesa_user");
			}
		}
	}, []);

	async function fetchAdminData(token: string) {
		const headers = {
			Authorization: `Bearer ${token}`
		};

		const [overviewResponse, usersResponse, betsResponse, signalsResponse, transactionsResponse] =
			await Promise.all([
				fetch(`${API_BASE}/admin/overview`, { headers }),
				fetch(`${API_BASE}/admin/users`, { headers }),
				fetch(`${API_BASE}/admin/bets`, { headers }),
				fetch(`${API_BASE}/admin/fraud-signals`, { headers }),
				fetch(`${API_BASE}/admin/transactions`, { headers })
			]);

		const [overviewData, usersData, betsData, signalsData, transactionsData] = await Promise.all([
			overviewResponse.json(),
			usersResponse.json(),
			betsResponse.json(),
			signalsResponse.json(),
			transactionsResponse.json()
		]);

		if (!overviewResponse.ok || !usersResponse.ok || !betsResponse.ok || !signalsResponse.ok || !transactionsResponse.ok) {
			throw new Error("Failed to fetch one or more admin resources");
		}

		setAdminOverview((overviewData?.overview as AdminOverview) || null);
		setAdminUsers(Array.isArray(usersData?.users) ? (usersData.users as UserProfile[]) : []);
		setAdminBets(Array.isArray(betsData?.bets) ? (betsData.bets as AdminBet[]) : []);
		setAdminSignals(Array.isArray(signalsData?.signals) ? (signalsData.signals as AdminSignal[]) : []);
		setAdminTransactions(
			Array.isArray(transactionsData?.transactions)
				? (transactionsData.transactions as AdminTransaction[])
				: []
		);
	}

	async function fetchProfileAndAccountData(token: string) {
		const headers = {
			Authorization: `Bearer ${token}`
		};

		const [profileResponse, transactionsResponse, betsResponse] = await Promise.all([
			fetch(`${API_BASE}/users/me`, { headers }),
			fetch(`${API_BASE}/users/me/transactions`, { headers }),
			fetch(`${API_BASE}/bets/my`, { headers })
		]);

		const [profileData, transactionsData, betsData] = await Promise.all([
			profileResponse.json(),
			transactionsResponse.json(),
			betsResponse.json()
		]);

		if (!profileResponse.ok || !transactionsResponse.ok || !betsResponse.ok) {
			throw new Error("Failed to fetch account data");
		}

		if (isUserProfile(profileData?.profile)) {
			setCurrentUser(profileData.profile);
			localStorage.setItem("sportpesa_user", JSON.stringify(profileData.profile));
		}

		setAccountTransactions(
			Array.isArray(transactionsData?.transactions)
				? (transactionsData.transactions as AccountTransaction[])
				: []
		);

		setAccountBets(Array.isArray(betsData?.bets) ? (betsData.bets as MyBet[]) : []);
	}

	async function refreshAccountWorkspace() {
		if (!accessToken || !isLoggedIn) {
			return;
		}

		setAccountLoading(true);
		setAccountError("");
		try {
			await fetchProfileAndAccountData(accessToken);
			setAccountMessage("Account data refreshed.");
		} catch (workspaceError) {
			setAccountError(workspaceError instanceof Error ? workspaceError.message : "Failed to refresh account workspace");
		} finally {
			setAccountLoading(false);
		}
	}

	async function handleDeposit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!accessToken) {
			setAccountError("Please login first.");
			return;
		}

		setAccountLoading(true);
		setAccountError("");
		setAccountMessage("");
		try {
			const response = await fetch(`${API_BASE}/wallet/deposit`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					amount: Number(depositAmount),
					phoneNumber: depositPhone
				})
			});

			const data = await parseJsonSafely(response);
			if (!response.ok) {
				throw new Error(getPayloadString(data, "error") || `Deposit failed (${response.status})`);
			}

			setAccountMessage("Deposit completed successfully.");
			setDepositAmount("");
			await fetchProfileAndAccountData(accessToken);
		} catch (depositError) {
			setAccountError(depositError instanceof Error ? depositError.message : "Deposit failed");
		} finally {
			setAccountLoading(false);
		}
	}

	async function handleWithdraw(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!accessToken) {
			setAccountError("Please login first.");
			return;
		}

		setAccountLoading(true);
		setAccountError("");
		setAccountMessage("");
		try {
			const response = await fetch(`${API_BASE}/wallet/withdraw`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					amount: Number(withdrawAmount)
				})
			});

			const data = await parseJsonSafely(response);
			if (!response.ok) {
				throw new Error(getPayloadString(data, "error") || `Withdraw failed (${response.status})`);
			}

			setAccountMessage("Withdrawal completed successfully.");
			setWithdrawAmount("");
			await fetchProfileAndAccountData(accessToken);
		} catch (withdrawError) {
			setAccountError(withdrawError instanceof Error ? withdrawError.message : "Withdrawal failed");
		} finally {
			setAccountLoading(false);
		}
	}

	function handleSelfExclusion(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSelfExclusionEnabled(true);
		setAccountMessage(`Self-exclusion enabled for ${selfExclusionHours} hours.`);
		setAccountError("");
	}

	useEffect(() => {
		let mounted = true;
		const monthRange = getMonthRange(selectedMonth);
		const params = new URLSearchParams({
			from: monthRange.from,
			to: monthRange.to,
			limit: "300"
		});
		const queryString = params.toString();

		async function checkApiOnline() {
			try {
				const response = await fetch(`${API_BASE}/health`);
				if (mounted) {
					setApiOnline(response.ok);
				}
			} catch {
				if (mounted) {
					setApiOnline(false);
				}
			}
		}

		async function loadMatches() {
			try {
				setLoading(true);
				await checkApiOnline();
				const footballResponse = await fetch(`${API_BASE}/football/matches?${queryString}`);
				const footballData = await footballResponse.json();

				if (!footballResponse.ok) {
					throw new Error(footballData?.error || "Football endpoint failed");
				}

				if (mounted) {
					const footballMatches = Array.isArray(footballData.matches)
						? (footballData.matches as Match[]).map((match) => ({
							...match,
							sport: "Football"
						}))
						: [];

					setMatches(footballMatches);
					setError("");
					setLiveStatus(
						footballData.source === "internal-fallback"
							? "Using internal fallback odds"
							: "Live football feed connected"
					);
				}
			} catch {
				try {
					const fallbackResponse = await fetch(`${API_BASE}/matches?${queryString}`);
					const fallbackData = await fallbackResponse.json();

					if (!fallbackResponse.ok) {
						throw new Error(fallbackData?.error || "Fallback endpoint failed");
					}

					if (mounted) {
						const fallbackMatches = Array.isArray(fallbackData.matches)
							? (fallbackData.matches as Match[]).map((match) => ({
								...match,
								sport: "Football"
							}))
							: [];

						setMatches(fallbackMatches);
						setError("");
						setLiveStatus("Using local match feed");
					}
				} catch {
					if (mounted) {
						setApiOnline(false);
						setMatches(localFootballMatches);
						setError("API unavailable. Showing local football fixtures and odds.");
						setLiveStatus("Offline mode: local fixtures loaded");
					}
				}
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		}

		loadMatches();

		return () => {
			mounted = false;
		};
	}, [localFootballMatches, selectedMonth]);

	useEffect(() => {
		let mounted = true;
		const monthRange = getMonthRange(selectedMonth);
		const params = new URLSearchParams({
			from: monthRange.from,
			to: monthRange.to,
			limit: "300"
		});
		const queryString = params.toString();

		if (!apiOnline) {
			setLiveStatus("API offline. Start server on port 5001");
			return () => {
				mounted = false;
			};
		}

		async function refreshFootballOdds() {
			try {
				const response = await fetch(`${API_BASE}/football/odds?${queryString}`);
				const data = await response.json();

				if (!response.ok) {
					if (response.status === 502) {
						setLiveStatus("Backend unavailable (502). Start API server.");
					}
					return;
				}

				if (!mounted || !Array.isArray(data.odds)) {
					return;
				}

				setMatches((previous) => {
					const byId = new Map<string, Record<Outcome, number>>();

					for (const entry of data.odds as Array<{ matchId?: string; odds?: Partial<Record<Outcome, number>> }>) {
						if (!entry?.matchId || !entry.odds) {
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
						const updatedOdds = byId.get(match.id);
						if (!updatedOdds) {
							return match;
						}

						return {
							...match,
							odds: updatedOdds
						};
					});
				});

				setLiveStatus(data.source === "internal-fallback" ? "Fallback odds updates" : "Live football odds updating");
			} catch {
				setLiveStatus("Unable to reach odds feed");
			}
		}

		refreshFootballOdds();
		const pollId = window.setInterval(refreshFootballOdds, 15000);

		const socket: Socket = io(SOCKET_BASE, {
			transports: ["websocket"]
		});

		socket.on("connect", () => {
			setLiveStatus("Live odds connected");
		});

		socket.on("disconnect", () => {
			setLiveStatus("Live feed disconnected");
		});

		socket.on("odds:snapshot", (payload: { matches: Match[] }) => {
			const incoming = Array.isArray(payload.matches)
				? payload.matches.map((match) => ({ ...match, sport: "Football" }))
				: [];
			setMatches(incoming);
		});

		socket.on("odds:update", (payload: { matches: Match[] }) => {
			const incoming = Array.isArray(payload.matches)
				? payload.matches.map((match) => ({ ...match, sport: "Football" }))
				: [];
			setMatches(incoming);
			setLiveStatus("Live odds updating");
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
			setSelectedDate(matchDateKey(new Date().toISOString()));
		}
	}, [activeTopNav]);

	useEffect(() => {
		if (!adminView || !accessToken || !isAdminUser) {
			return;
		}

		setAdminLoading(true);
		setAdminError("");
		fetchAdminData(accessToken)
			.then(() => {
				setAdminMessage((previous) => previous || "Admin dashboard ready.");
			})
			.catch((loadError) => {
				setAdminError(loadError instanceof Error ? loadError.message : "Failed to load admin dashboard");
			})
			.finally(() => {
				setAdminLoading(false);
			});
	}, [accessToken, adminView, isAdminUser]);

	useEffect(() => {
		if (!accountWorkspaceView || !accessToken) {
			return;
		}

		setAccountLoading(true);
		setAccountError("");
		fetchProfileAndAccountData(accessToken)
			.then(() => {
				setAccountMessage((previous) => previous || "Account workspace ready.");
			})
			.catch((loadError) => {
				setAccountError(loadError instanceof Error ? loadError.message : "Failed to load account workspace");
			})
			.finally(() => {
				setAccountLoading(false);
			});
	}, [accessToken, accountWorkspaceView]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			setActiveHeroSlide((previous) => (previous + 1) % HERO_SLIDES.length);
		}, 6000);

		return () => {
			window.clearInterval(timer);
		};
	}, []);

	function goToPrevSlide() {
		setActiveHeroSlide((previous) => (previous - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
	}

	function goToNextSlide() {
		setActiveHeroSlide((previous) => (previous + 1) % HERO_SLIDES.length);
	}

	useEffect(() => {
		if (activeModule === "today") {
			setSelectedDate(matchDateKey(new Date().toISOString()));
		} else {
			setSelectedDate("all");
		}

		setSelectedLeague("all");
	}, [selectedMonth, activeModule]);

	const moduleTitle = useMemo(() => {
		if (adminView) {
			return "Admin Dashboard";
		}

		if (!sportsbookView) {
			return TOP_NAV_CONTENT[activeTopNav].heading;
		}

		return [...FOOTBALL_MODULES, ...OTHER_SPORT_MODULES].find((module) => module.key === activeModule)?.label || "Matches";
	}, [activeModule, activeTopNav, adminView, sportsbookView]);

	const topNavContent = TOP_NAV_CONTENT[activeTopNav];

	const scopedMatches = useMemo(() => {
		const merged = [...matches, ...otherSportsMatches];
		const now = new Date();
		const todayKey = matchDateKey(now.toISOString());
		const sorted = (items: Match[]) =>
			items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

		switch (activeModule) {
			case "highlights":
				return sorted(
					merged.filter(
						(match) =>
							match.sport === "Football" &&
							(HIGHLIGHT_TEAMS.has(match.homeTeam) || HIGHLIGHT_TEAMS.has(match.awayTeam))
					)
				);
			case "popular":
				return sorted(merged.filter((match) => match.sport === "Football"));
			case "goalRush":
				return sorted(
					merged
						.filter((match) => match.sport === "Football")
						.filter((match) => match.odds.home + match.odds.draw + match.odds.away >= 8.7)
				);
			case "top5":
				return sorted(merged.filter((match) => match.sport === "Football" && TOP_LEAGUES.has(match.league)));
			case "countries":
				return sorted(merged.filter((match) => match.sport === "Football"));
			case "today":
				return sorted(merged.filter((match) => matchDateKey(match.startTime) === todayKey));
			case "upcoming":
				return sorted(merged.filter((match) => new Date(match.startTime).getTime() >= now.getTime()));
			case "otherSports":
				return sorted(merged.filter((match) => match.sport !== "Football"));
			case "efootball":
				return sorted(merged.filter((match) => match.sport === "eFootball"));
			case "basketball":
				return sorted(merged.filter((match) => match.sport === "Basketball"));
			case "tennis":
				return sorted(merged.filter((match) => match.sport === "Tennis"));
			case "rugby":
				return sorted(merged.filter((match) => match.sport === "Rugby Union"));
			case "iceHockey":
				return sorted(merged.filter((match) => match.sport === "Ice Hockey"));
			case "volleyball":
				return sorted(merged.filter((match) => match.sport === "Volleyball"));
			case "handball":
				return sorted(merged.filter((match) => match.sport === "Handball"));
			case "cricket":
				return sorted(merged.filter((match) => match.sport === "Cricket"));
			case "baseball":
				return sorted(merged.filter((match) => match.sport === "Baseball"));
			case "boxing":
				return sorted(merged.filter((match) => match.sport === "Boxing"));
			case "mma":
				return sorted(merged.filter((match) => match.sport === "MMA"));
			case "americanFootball":
				return sorted(merged.filter((match) => match.sport === "American Football"));
			default:
				return sorted(merged);
		}
	}, [activeModule, matches, otherSportsMatches]);

	const availableDates = useMemo(() => {
		const byDate = new Set<string>();

		for (const match of scopedMatches) {
			if (typeof match.startTime === "string" && match.startTime.length >= 10) {
				byDate.add(matchDateKey(match.startTime));
			}
		}

		return Array.from(byDate).sort((a, b) => a.localeCompare(b));
	}, [scopedMatches]);

	const availableLeagues = useMemo(() => {
		const leagues = new Set<string>();
		for (const match of scopedMatches) {
			if (match.league) {
				leagues.add(match.league);
			}
		}
		return Array.from(leagues).sort((a, b) => a.localeCompare(b));
	}, [scopedMatches]);

	const visibleMatches = useMemo(() => {
		const withLeague =
			selectedLeague === "all"
				? scopedMatches
				: scopedMatches.filter((match) => match.league === selectedLeague);

		if (selectedDate === "all") {
			return withLeague;
		}

		return withLeague.filter((match) => matchDateKey(match.startTime) === selectedDate);
	}, [scopedMatches, selectedDate, selectedLeague]);

	const betslip = useMemo(() => Object.values(activeSelection), [activeSelection]);

	const combinedOdds = useMemo(() => {
		if (!betslip.length) return 0;
		return Number(
			betslip
				.reduce((acc, selection) => acc * selection.odd, 1)
				.toFixed(2)
		);
	}, [betslip]);

	const potentialWin = useMemo(() => {
		const parsedStake = Number(stake || 0);
		if (!parsedStake || !combinedOdds) return 0;
		return Number((parsedStake * combinedOdds).toFixed(2));
	}, [stake, combinedOdds]);

	function toggleSelection(match: Match, outcome: Outcome) {
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
					odd: match.odds[outcome],
					label: `${match.homeTeam} vs ${match.awayTeam}`
				}
			};
		});
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
					fullName,
					email: email || undefined,
					phoneNumber: phoneNumber || undefined,
					password
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

			const userPayload = data?.user;
			if (isUserProfile(userPayload)) {
				setCurrentUser(userPayload);
				localStorage.setItem("sportpesa_user", JSON.stringify(userPayload));
			}

			setAuthMessage("Registration successful. You are now logged in.");
			setPassword("");
		} catch (authRequestError) {
			setAuthError(authRequestError instanceof Error ? authRequestError.message : "Registration failed");
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

			const userPayload = data?.user;
			if (isUserProfile(userPayload)) {
				setCurrentUser(userPayload);
				localStorage.setItem("sportpesa_user", JSON.stringify(userPayload));
				setAccountView(true);
				if (userPayload.role === "admin") {
					setShowAdminDashboard(true);
					setAdminMessage("Admin session active.");
					setAdminError("");
				} else {
					setShowAdminDashboard(false);
				}
			}

			setAuthMessage("Login successful.");
			setPassword("");
		} catch (authRequestError) {
			setAuthError(authRequestError instanceof Error ? authRequestError.message : "Login failed");
		} finally {
			setAuthLoading(false);
		}
	}

	async function refreshAdminDashboard() {
		if (!accessToken || !isAdminUser) {
			setAdminError("Admin session missing. Login with an admin account.");
			return;
		}

		setAdminLoading(true);
		setAdminError("");
		try {
			await fetchAdminData(accessToken);
			setAdminMessage("Dashboard refreshed.");
		} catch (refreshError) {
			setAdminError(refreshError instanceof Error ? refreshError.message : "Failed to refresh admin dashboard");
		} finally {
			setAdminLoading(false);
		}
	}

	async function handleAdminResultSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!accessToken || !isAdminUser) {
			setAdminError("Admin session missing. Login with an admin account.");
			return;
		}

		setAdminLoading(true);
		setAdminError("");
		try {
			const response = await fetch(`${API_BASE}/results`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					matchId: adminMatchId,
					result: adminResult
				})
			});

			const data = await parseJsonSafely(response);
			if (!response.ok) {
				throw new Error(getPayloadString(data, "error") || `Result update failed (${response.status})`);
			}

			setAdminMessage("Match result processed.");
			await fetchAdminData(accessToken);
		} catch (submitError) {
			setAdminError(submitError instanceof Error ? submitError.message : "Failed to process result");
		} finally {
			setAdminLoading(false);
		}
	}

	async function handleAdminPayout(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!accessToken || !isAdminUser) {
			setAdminError("Admin session missing. Login with an admin account.");
			return;
		}

		setAdminLoading(true);
		setAdminError("");
		try {
			const response = await fetch(`${API_BASE}/admin/payouts/${adminPayoutBetId}`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			const data = await parseJsonSafely(response);
			if (!response.ok) {
				throw new Error(getPayloadString(data, "error") || `Admin payout failed (${response.status})`);
			}

			setAdminMessage("Admin payout processed.");
			await fetchAdminData(accessToken);
		} catch (payoutError) {
			setAdminError(payoutError instanceof Error ? payoutError.message : "Failed to process admin payout");
		} finally {
			setAdminLoading(false);
		}
	}

	function handleAdminPanelClose() {
		setShowAdminDashboard(false);
		setActiveAdminTool("overview");
		setAdminOverview(null);
		setAdminUsers([]);
		setAdminBets([]);
		setAdminSignals([]);
		setAdminTransactions([]);
		setAdminMessage("Admin dashboard hidden.");
		setAdminError("");
	}

	function handleLogout() {
		setAccessToken("");
		setCurrentUser(null);
		setAccountView(false);
		setActiveAccountTool("deposit");
		setAccountTransactions([]);
		setAccountBets([]);
		setShowAdminDashboard(false);
		setAdminOverview(null);
		setAdminUsers([]);
		setAdminBets([]);
		setAdminSignals([]);
		setAdminTransactions([]);
		setAuthMessage("Logged out successfully.");
		setAuthError("");
		localStorage.removeItem("sportpesa_access_token");
		localStorage.removeItem("sportpesa_user");
	}

	return (
		<div className="page-shell">
			<header className="top-header">
				<div className="brand-block">
					<h1>SportPesa</h1>
					<span>KENYA</span>
				</div>
				<div className="top-actions">
					{isLoggedIn ? (
						<>
							<div className="session-pill">
								<span>Signed in</span>
								<strong>{currentUser?.fullName}</strong>
							</div>
							<button type="button" onClick={() => setAccountView((previous) => !previous)}>
								{accountView ? "Hide Account" : "Account"}
							</button>
							{isAdminUser && (
								<button
									type="button"
									onClick={() => setShowAdminDashboard((previous) => !previous)}
								>
									{showAdminDashboard ? "Hide Admin" : "Admin Dashboard"}
								</button>
							)}
							<button type="button" className="logout-btn" onClick={handleLogout}>Logout</button>
						</>
					) : (
						<>
							<button type="button" onClick={() => setAuthMode("login")}>Login</button>
							<button type="button" className="register-btn" onClick={() => setAuthMode("register")}>Register</button>
						</>
					)}
				</div>
			</header>

			<nav className="main-nav">
				{TOP_NAV_ITEMS.map((item) => (
					<button
						type="button"
						key={item.key}
						className={`top-nav-btn ${activeTopNav === item.key ? "active" : ""}`}
						onClick={() => setActiveTopNav(item.key)}
					>
						<span>{item.label}</span>
						{item.badge && <em className="top-nav-badge">{item.badge}</em>}
						{typeof item.count === "number" && <em className="top-nav-count">{item.count}</em>}
						{item.hasCaret && <em className="top-nav-caret">▾</em>}
					</button>
				))}
			</nav>

			<main className="content-grid">
				<aside className="left-panel">
					{accountWorkspaceView ? (
						<>
							<div className="account-summary-box">
								<p>Logged in</p>
								<strong>{currentUser?.phoneNumber || currentUser?.email || currentUser?.fullName}</strong>
								<div className="account-balance-pill">
									<span>Balance</span>
									<b>KSH {currentUser?.balance.toFixed(2) ?? "0.00"}</b>
								</div>
							</div>

							<h3>Account</h3>
							<ul>
								{ACCOUNT_TOOLS.map((tool) => (
									<li key={tool.key}>
										<button
											type="button"
											className={`module-btn account-module-btn ${activeAccountTool === tool.key ? "active" : ""}`}
											onClick={() => setActiveAccountTool(tool.key)}
										>
											<span className="account-tool-icon" aria-hidden="true">{tool.icon}</span>
											<span>{tool.label}</span>
											{tool.marker && <span className="account-tool-marker">{tool.marker}</span>}
										</button>
									</li>
								))}
							</ul>
						</>
					) : adminView ? (
						<>
							<h3>Admin Tools</h3>
							<ul>
								{ADMIN_TOOLS.map((tool) => (
									<li key={tool.key}>
										<button
											type="button"
											className={`module-btn ${activeAdminTool === tool.key ? "active" : ""}`}
											onClick={() => setActiveAdminTool(tool.key)}
										>
											{tool.label}
										</button>
									</li>
								))}
							</ul>
						</>
					) : (
						<>
							<h3>Football</h3>
							<ul>
								{FOOTBALL_MODULES.map((module) => (
									<li key={module.key}>
										<button
											type="button"
											className={`module-btn ${activeModule === module.key ? "active" : ""}`}
											onClick={() => {
												setActiveTopNav("sports");
												setActiveModule(module.key);
											}}
										>
											{module.label}
										</button>
									</li>
								))}
							</ul>
							<h4>Other Sports</h4>
							<ul>
								{OTHER_SPORT_MODULES.map((module) => (
									<li key={module.key}>
										<button
											type="button"
											className={`module-btn ${activeModule === module.key ? "active" : ""}`}
											onClick={() => {
												setActiveTopNav("sports");
												setActiveModule(module.key);
											}}
										>
											{module.label}
										</button>
									</li>
								))}
							</ul>
						</>
					)}
				</aside>

				<section className="center-panel">
					<div className="hero-banner">
						<div className="hero-carousel">
							{HERO_SLIDES.map((slide, index) => (
								<img
									key={slide.id}
									src={slide.image}
									alt={slide.alt}
									className={`hero-slide ${index === activeHeroSlide ? "active" : ""}`}
								/>
							))}

							<button type="button" className="hero-arrow left" onClick={goToPrevSlide} aria-label="Previous slide">
								&#8249;
							</button>
							<button type="button" className="hero-arrow right" onClick={goToNextSlide} aria-label="Next slide">
								&#8250;
							</button>

							<div className="hero-dots" role="tablist" aria-label="Hero slides">
								{HERO_SLIDES.map((slide, index) => (
									<button
										type="button"
										key={slide.id}
										className={`hero-dot ${index === activeHeroSlide ? "active" : ""}`}
										onClick={() => setActiveHeroSlide(index)}
										aria-label={`Go to slide ${index + 1}`}
									/>
								))}
							</div>
						</div>
						<div className="hero-status">
							<p>{moduleTitle}</p>
							<strong>{sportsbookView ? liveStatus : topNavContent.subtitle}</strong>
						</div>
					</div>

					{adminView && (
						<section className="admin-dashboard">
							<h3>Admin Dashboard</h3>
							<p>Secure control center for platform operations. Access is granted from normal login when account role is admin.</p>

							{adminError && <p className="error-text">{adminError}</p>}
							{adminMessage && <p className="status-text">{adminMessage}</p>}

							{isAdminUser && (
								<>
									<div className="admin-panel-grid">
										<div className="admin-card">
											<h4>Session</h4>
											<p>{currentUser ? `Admin: ${currentUser.fullName}` : "Authenticated"}</p>
											<p>Current Module: {ADMIN_TOOLS.find((tool) => tool.key === activeAdminTool)?.label}</p>
											<button type="button" onClick={refreshAdminDashboard} disabled={adminLoading}>Refresh Data</button>
											<button type="button" onClick={handleAdminPanelClose}>Hide Dashboard</button>
										</div>

										{activeAdminTool === "overview" && (
											<div className="admin-card">
												<h4>Overview</h4>
												<p>Users: {adminOverview?.users ?? 0}</p>
												<p>Bets: {adminOverview?.bets ?? 0}</p>
												<p>Pending Bets: {adminOverview?.pendingBets ?? 0}</p>
												<p>Won Bets: {adminOverview?.wonBets ?? 0}</p>
												<p>Payouts: {adminOverview?.payouts ?? 0}</p>
												<p>Matches: {adminOverview?.matches ?? 0}</p>
											</div>
										)}

										{activeAdminTool === "results" && (
											<form className="admin-card" onSubmit={handleAdminResultSubmit}>
												<h4>Process Match Result</h4>
												<input
													type="text"
													placeholder="Match ID"
													value={adminMatchId}
													onChange={(event) => setAdminMatchId(event.target.value)}
													required
												/>
												<select value={adminResult} onChange={(event) => setAdminResult(event.target.value as Outcome)}>
													<option value="home">Home</option>
													<option value="draw">Draw</option>
													<option value="away">Away</option>
												</select>
												<button type="submit" disabled={adminLoading}>Submit Result</button>
												<div className="admin-inline-list">
													{resultCandidateMatches.map((match) => (
														<button type="button" key={match.id} onClick={() => setAdminMatchId(match.id)}>
															{match.homeTeam} vs {match.awayTeam}
														</button>
													))}
												</div>
											</form>
										)}

										{activeAdminTool === "payouts" && (
											<form className="admin-card" onSubmit={handleAdminPayout}>
												<h4>Force Payout (Admin)</h4>
												<input
													type="text"
													placeholder="Won Bet ID"
													value={adminPayoutBetId}
													onChange={(event) => setAdminPayoutBetId(event.target.value)}
													required
												/>
												<button type="submit" disabled={adminLoading}>Process Payout</button>
												<div className="admin-inline-list">
													{wonUnpaidBets.map((bet) => (
														<button type="button" key={bet.id} onClick={() => setAdminPayoutBetId(bet.id)}>
															{bet.id.slice(0, 8)} | {bet.potentialWin.toFixed(2)}
														</button>
													))}
													{!wonUnpaidBets.length && <span>No unpaid won bets.</span>}
												</div>
											</form>
										)}
									</div>

									{(activeAdminTool === "users" || activeAdminTool === "overview") && (
										<div className="admin-table-grid">
											<section className="admin-card">
												<h4>Users ({adminUsers.length})</h4>
												<div className="admin-table-wrap">
													<table>
														<thead>
															<tr><th>Name</th><th>Email</th><th>Role</th><th>Balance</th></tr>
														</thead>
														<tbody>
															{adminUsers.slice(0, 40).map((user) => (
																<tr key={user.id}><td>{user.fullName}</td><td>{user.email}</td><td>{user.role}</td><td>{user.balance.toFixed(2)}</td></tr>
															))}
														</tbody>
													</table>
												</div>
											</section>
										</div>
									)}

									{(activeAdminTool === "bets" || activeAdminTool === "overview") && (
										<div className="admin-table-grid">
											<section className="admin-card">
												<h4>Bets ({adminBets.length})</h4>
												<div className="admin-table-wrap">
													<table>
														<thead>
															<tr><th>Bet ID</th><th>User</th><th>Stake</th><th>Status</th><th>Paid</th></tr>
														</thead>
														<tbody>
															{adminBets.slice(0, 40).map((bet) => (
																<tr key={bet.id}><td>{bet.id}</td><td>{bet.userId}</td><td>{bet.stake.toFixed(2)}</td><td>{bet.status}</td><td>{bet.paidOut ? "Yes" : "No"}</td></tr>
															))}
														</tbody>
													</table>
												</div>
											</section>
										</div>
									)}

									{(activeAdminTool === "fraud" || activeAdminTool === "overview") && (
										<div className="admin-table-grid">
											<section className="admin-card">
												<h4>Fraud Signals ({adminSignals.length})</h4>
												<ul className="admin-signal-list">
													{adminSignals.slice(0, 20).map((signal) => (
														<li key={signal.userId}>{signal.email} | withdrawals {signal.withdrawalCount} | high stake bets {signal.highStakeBets}</li>
													))}
													{!adminSignals.length && <li>No active fraud signals.</li>}
												</ul>
											</section>
										</div>
									)}

									{(activeAdminTool === "transactions" || activeAdminTool === "overview") && (
										<div className="admin-table-grid">
											<section className="admin-card">
												<h4>Transactions ({adminTransactions.length})</h4>
												<div className="admin-table-wrap">
													<table>
														<thead>
															<tr><th>Type</th><th>User</th><th>Amount</th><th>Status</th><th>Date</th></tr>
														</thead>
														<tbody>
															{adminTransactions.slice(0, 40).map((txn) => (
																<tr key={txn.id}><td>{txn.type}</td><td>{txn.userId}</td><td>{txn.amount.toFixed(2)}</td><td>{txn.status}</td><td>{formatKickoff(txn.createdAt)}</td></tr>
															))}
														</tbody>
													</table>
												</div>
											</section>
										</div>
									)}
								</>
							)}
						</section>
					)}

					{accountWorkspaceView && (
						<section className="account-dashboard">
							<h3>Account</h3>
							{accountError && <p className="error-text">{accountError}</p>}
							{accountMessage && <p className="status-text">{accountMessage}</p>}

							{activeAccountTool === "deposit" && (
								<div className="account-card">
									<h4>Deposit</h4>
									<p>Please select a payment method:</p>
									<div className="payment-methods">
										<button type="button" className="mpesa">M-PESA</button>
										<button type="button" className="airtel">airtel money</button>
									</div>

									<form className="account-form" onSubmit={handleDeposit}>
										<label htmlFor="deposit-amount">Amount</label>
										<div className="amount-row">
											<span>KSH</span>
											<input
												id="deposit-amount"
												type="number"
												min="1"
												placeholder="Amount to deposit"
												value={depositAmount}
												onChange={(event) => setDepositAmount(event.target.value)}
												required
											/>
										</div>
										<input
											type="tel"
											placeholder="M-Pesa phone number"
											value={depositPhone}
											onChange={(event) => setDepositPhone(event.target.value)}
											required
										/>
										<button type="submit" disabled={accountLoading}>{accountLoading ? "Processing..." : "Deposit"}</button>
									</form>

									<p className="status-text">Minimum KSH 1.00, Maximum KSH 250,000.00</p>
									<ol className="account-instructions">
										<li>Go to M-Pesa menu</li>
										<li>Select payment services</li>
										<li>Click on Paybill</li>
										<li>Enter business number as 955100</li>
										<li>Enter account as your registered mobile number</li>
										<li>Enter amount and confirm</li>
									</ol>
								</div>
							)}

							{activeAccountTool === "withdraw" && (
								<div className="account-card">
									<h4>Withdraw</h4>
									<form className="account-form" onSubmit={handleWithdraw}>
										<input
											type="number"
											min="1"
											placeholder="Amount to withdraw"
											value={withdrawAmount}
											onChange={(event) => setWithdrawAmount(event.target.value)}
											required
										/>
										<button type="submit" disabled={accountLoading}>{accountLoading ? "Processing..." : "Withdraw"}</button>
									</form>
									<p className="status-text">Withdrawal is sent to your wallet after successful processing.</p>
								</div>
							)}

							{activeAccountTool === "betHistory" && (
								<div className="account-card">
									<h4>Bet History ({accountBets.length})</h4>
									<div className="account-table-wrap">
										<table>
											<thead>
												<tr><th>Bet ID</th><th>Stake</th><th>Potential Win</th><th>Status</th><th>Date</th></tr>
											</thead>
											<tbody>
												{accountBets.slice(0, 40).map((bet) => (
													<tr key={bet.id}><td>{bet.id}</td><td>{bet.stake.toFixed(2)}</td><td>{bet.potentialWin.toFixed(2)}</td><td>{bet.status}</td><td>{formatKickoff(bet.createdAt)}</td></tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}

							{activeAccountTool === "transactionHistory" && (
								<div className="account-card">
									<h4>Transaction History ({accountTransactions.length})</h4>
									<div className="account-table-wrap">
										<table>
											<thead>
												<tr><th>Type</th><th>Amount</th><th>Status</th><th>Reference</th><th>Date</th></tr>
											</thead>
											<tbody>
												{accountTransactions.slice(0, 50).map((transaction) => (
													<tr key={transaction.id}><td>{transaction.type}</td><td>{transaction.amount.toFixed(2)}</td><td>{transaction.status}</td><td>{transaction.reference || "-"}</td><td>{formatKickoff(transaction.createdAt)}</td></tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}

							{activeAccountTool === "settings" && (
								<div className="account-card">
									<h4>Settings</h4>
									<p>Name: {currentUser?.fullName}</p>
									<p>Email: {currentUser?.email}</p>
									<p>Phone: {currentUser?.phoneNumber || "-"}</p>
									<button type="button" onClick={refreshAccountWorkspace} disabled={accountLoading}>Refresh Profile</button>
								</div>
							)}

							{activeAccountTool === "selfExclusion" && (
								<div className="account-card">
									<h4>Self Exclusion</h4>
									<form className="account-form" onSubmit={handleSelfExclusion}>
										<select value={selfExclusionHours} onChange={(event) => setSelfExclusionHours(event.target.value)}>
											<option value="24">24 hours</option>
											<option value="72">72 hours</option>
											<option value="168">7 days</option>
											<option value="720">30 days</option>
										</select>
										<button type="submit">Activate Self Exclusion</button>
									</form>
									<p className="status-text">
										{selfExclusionEnabled
											? `Self exclusion active for ${selfExclusionHours} hours.`
											: "Self exclusion is not active."}
									</p>
								</div>
							)}
						</section>
					)}

					{!adminView && !accountWorkspaceView && !sportsbookView && (
						<section className="product-panel">
							<h3>{topNavContent.heading}</h3>
							<p>{topNavContent.subtitle}</p>
							<div className="product-grid">
								{topNavContent.cards.map((card) => (
									<article key={card}>
										<strong>{card}</strong>
										<span>Ready to play</span>
									</article>
								))}
							</div>
						</section>
					)}

					{!adminView && !accountWorkspaceView && sportsbookView && (
						<>

					<div className="filter-bar">
						<label htmlFor="month-filter">Month</label>
						<select
							id="month-filter"
							value={selectedMonth}
							onChange={(event) => setSelectedMonth(event.target.value)}
						>
							{monthOptions.map((option) => (
								<option value={option.value} key={option.value}>
									{option.label}
								</option>
							))}
						</select>

						<label htmlFor="date-filter">Date</label>
						<select
							id="date-filter"
							value={selectedDate}
							onChange={(event) => setSelectedDate(event.target.value)}
						>
							<option value="all">All dates</option>
							{availableDates.map((dateValue) => (
								<option value={dateValue} key={dateValue}>
									{new Date(`${dateValue}T00:00:00Z`).toLocaleDateString("en-KE", {
										weekday: "short",
										day: "2-digit",
										month: "short",
										year: "numeric"
									})}
								</option>
							))}
						</select>

						{activeModule === "countries" && (
							<>
								<label htmlFor="league-filter">Country/League</label>
								<select
									id="league-filter"
									value={selectedLeague}
									onChange={(event) => setSelectedLeague(event.target.value)}
								>
									<option value="all">All countries</option>
									{availableLeagues.map((league) => (
										<option value={league} key={league}>
											{league}
										</option>
									))}
								</select>
							</>
						)}
					</div>

					{error && <p className="error-text">{error}</p>}
					{loading && <p className="status-text">Loading matches...</p>}
					{!loading && !visibleMatches.length && (
						<p className="status-text">No matches for the selected month/date.</p>
					)}

					<div className="odds-table">
						<div className="odds-head">
							<span>Fixture</span>
							<span>1</span>
							<span>X</span>
							<span>2</span>
						</div>

						{visibleMatches.map((match) => (
							<div className="odds-row" key={match.id}>
								<div className="fixture-cell">
									<small>{formatKickoff(match.startTime)} | {match.league}</small>
									<strong>{match.homeTeam}</strong>
									<strong>{match.awayTeam}</strong>
								</div>

								{(["home", "draw", "away"] as Outcome[]).map((outcome) => {
									const isActive = activeSelection[match.id]?.outcome === outcome;
									return (
										<button
											type="button"
											key={outcome}
											className={`odd-btn ${isActive ? "active" : ""}`}
											onClick={() => toggleSelection(match, outcome)}
										>
											{match.odds[outcome].toFixed(2)}
										</button>
									);
								})}
							</div>
						))}
					</div>
						</>
					)}
				</section>

				<aside className="right-panel">
					<h3>Betslip</h3>
					<p className={`session-state ${isLoggedIn ? "logged-in" : "logged-out"}`}>
						{isLoggedIn
							? `Account ready: ${currentUser?.fullName}`
							: "Guest mode: login required for wallet and bet placement"}
					</p>

					<section className="auth-card">
						<h4>
							{isLoggedIn
								? "My Account"
								: authMode === "register"
									? "Create Account"
									: "User Login"}
						</h4>

						{currentUser ? (
							<div className="auth-user-box">
								<p>Welcome, <strong>{currentUser.fullName}</strong></p>
								<p>{currentUser.email}</p>
								<p>Balance: KES {currentUser.balance.toFixed(2)}</p>
								<button type="button" onClick={handleLogout}>Logout</button>
							</div>
						) : authMode === "register" ? (
							<form onSubmit={handleRegister} className="auth-form">
								<input
									type="text"
									placeholder="Full name"
									value={fullName}
									onChange={(event) => setFullName(event.target.value)}
									required
								/>
								<input
									type="email"
									placeholder="Email (optional if phone used)"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
								/>
								<input
									type="tel"
									placeholder="Phone number"
									value={phoneNumber}
									onChange={(event) => setPhoneNumber(event.target.value)}
								/>
								<input
									type="password"
									placeholder="Password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									required
									minLength={6}
								/>
								<button type="submit" disabled={authLoading}>{authLoading ? "Creating..." : "Create Account"}</button>
							</form>
						) : (
							<form onSubmit={handleLogin} className="auth-form">
								<input
									type="text"
									placeholder="Email or phone"
									value={identifier}
									onChange={(event) => setIdentifier(event.target.value)}
									required
								/>
								<input
									type="password"
									placeholder="Password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									required
								/>
								<button type="submit" disabled={authLoading}>{authLoading ? "Logging in..." : "Login"}</button>
							</form>
						)}

						{authError && <p className="error-text">{authError}</p>}
						{authMessage && <p className="status-text">{authMessage}</p>}
						{accessToken && <p className="token-state">Authenticated session active</p>}
					</section>

					{!betslip.length && (
						<p className="status-text">You have not selected any bet.</p>
					)}

					{!!betslip.length && (
						<div className="betslip-items">
							{betslip.map((selection) => (
								<article key={selection.matchId}>
									<h5>{selection.label}</h5>
									<p>
										Pick: {selection.outcome.toUpperCase()} @ {selection.odd.toFixed(2)}
									</p>
								</article>
							))}
						</div>
					)}

					<label htmlFor="stake">Stake (KES)</label>
					<input
						id="stake"
						type="number"
						min="1"
						value={stake}
						onChange={(event) => setStake(event.target.value)}
					/>

					<div className="calc-row">
						<span>Combined Odds</span>
						<strong>{combinedOdds || "-"}</strong>
					</div>
					<div className="calc-row">
						<span>Potential Win</span>
						<strong>KES {potentialWin || 0}</strong>
					</div>

					<button type="button" className="place-btn" disabled={!betslip.length || !isLoggedIn}>
						Place Bet
					</button>

					{!isLoggedIn && <p className="status-text">Sign in to place your bet and use wallet actions.</p>}

					<section className="care-box">
						<h4>Customer Care</h4>
						<p>0755 079 079</p>
						<p>0709 079 079</p>
						<p>care@ke.sportpesa.com</p>
					</section>
				</aside>
			</main>
		</div>
	);
}

export default App;
