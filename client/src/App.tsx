import { useEffect, useMemo, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import "./App.css";

type Outcome = "home" | "draw" | "away";

type Match = {
	id: string;
	homeTeam: string;
	awayTeam: string;
	league: string;
	startTime: string;
	odds: Record<Outcome, number>;
	status: string;
	result: Outcome | null;
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

type ApiPayload = Record<string, unknown>;

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE || "";

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
	const [apiOnline, setApiOnline] = useState(true);
	const isLoggedIn = Boolean(accessToken && currentUser);

	useEffect(() => {
		const savedToken = localStorage.getItem("sportpesa_access_token") || "";
		const savedUser = localStorage.getItem("sportpesa_user");

		if (savedToken) {
			setAccessToken(savedToken);
		}

		if (savedUser) {
			try {
				setCurrentUser(JSON.parse(savedUser));
			} catch {
				localStorage.removeItem("sportpesa_user");
			}
		}
	}, []);

	useEffect(() => {
		let mounted = true;

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
				const footballResponse = await fetch(`${API_BASE}/football/matches`);
				const footballData = await footballResponse.json();

				if (!footballResponse.ok) {
					throw new Error(footballData?.error || "Football endpoint failed");
				}

				if (mounted) {
					setMatches(footballData.matches ?? []);
					setError("");
					setLiveStatus(
						footballData.source === "internal-fallback"
							? "Using internal fallback odds"
							: "Live football feed connected"
					);
				}
			} catch {
				try {
					const fallbackResponse = await fetch(`${API_BASE}/matches`);
					const fallbackData = await fallbackResponse.json();

					if (!fallbackResponse.ok) {
						throw new Error(fallbackData?.error || "Fallback endpoint failed");
					}

					if (mounted) {
						setMatches(fallbackData.matches ?? []);
						setError("");
						setLiveStatus("Using local match feed");
					}
				} catch {
					if (mounted) {
						setApiOnline(false);
						setError("Unable to fetch football matches. Ensure API is running on port 5001.");
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
	}, []);

	useEffect(() => {
		let mounted = true;

		if (!apiOnline) {
			setLiveStatus("API offline. Start server on port 5001");
			return () => {
				mounted = false;
			};
		}

		async function refreshFootballOdds() {
			try {
				const response = await fetch(`${API_BASE}/football/odds`);
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
			setMatches(payload.matches ?? []);
		});

		socket.on("odds:update", (payload: { matches: Match[] }) => {
			setMatches(payload.matches ?? []);
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
	}, [apiOnline]);

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
			}

			setAuthMessage("Login successful.");
			setPassword("");
		} catch (authRequestError) {
			setAuthError(authRequestError instanceof Error ? authRequestError.message : "Login failed");
		} finally {
			setAuthLoading(false);
		}
	}

	function handleLogout() {
		setAccessToken("");
		setCurrentUser(null);
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
				<a href="#">Sports</a>
				<a href="#">Live Games</a>
				<a href="#">Aviator</a>
				<a href="#">Casino</a>
				<a href="#">Jackpots</a>
				<a href="#">More</a>
			</nav>

			<main className="content-grid">
				<aside className="left-panel">
					<h3>Football</h3>
					<ul>
						<li>Highlights</li>
						<li>Popular Games</li>
						<li>Top 5 Leagues</li>
						<li>Today Games</li>
						<li>Upcoming Games</li>
					</ul>
					<h4>Other Sports</h4>
					<ul>
						<li>Basketball</li>
						<li>Tennis</li>
						<li>Rugby Union</li>
						<li>Cricket</li>
						<li>MMA</li>
					</ul>
				</aside>

				<section className="center-panel">
					<div className="hero-banner">
						<img src="/sport.svg" alt="SportPesa" />
						<div>
							<p>Football Betting Odds</p>
							<strong>{liveStatus}</strong>
						</div>
					</div>

					{error && <p className="error-text">{error}</p>}
					{loading && <p className="status-text">Loading matches...</p>}

					<div className="odds-table">
						<div className="odds-head">
							<span>Fixture</span>
							<span>1</span>
							<span>X</span>
							<span>2</span>
						</div>

						{matches.map((match) => (
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
