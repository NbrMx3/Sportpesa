import { useEffect, useMemo, useState } from "react";
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

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";
const SOCKET_BASE = import.meta.env.VITE_SOCKET_BASE || "http://localhost:5000";

function formatKickoff(dateString: string) {
	const date = new Date(dateString);
	return date.toLocaleString("en-KE", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	});
}

function App() {
	const [matches, setMatches] = useState<Match[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeSelection, setActiveSelection] = useState<Record<string, BetSelection>>({});
	const [stake, setStake] = useState("100");
	const [error, setError] = useState("");
	const [liveStatus, setLiveStatus] = useState("Connecting...");

	useEffect(() => {
		let mounted = true;

		async function loadMatches() {
			try {
				setLoading(true);
				const response = await fetch(`${API_BASE}/matches`);
				const data = await response.json();

				if (mounted) {
					setMatches(data.matches ?? []);
					setError("");
				}
			} catch {
				if (mounted) {
					setError("Unable to fetch matches. Ensure API is running on port 5000.");
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

		return () => {
			socket.disconnect();
		};
	}, []);

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

	return (
		<div className="page-shell">
			<header className="top-header">
				<div className="brand-block">
					<h1>SportPesa</h1>
					<span>KENYA</span>
				</div>
				<div className="top-actions">
					<button type="button">Login</button>
					<button type="button" className="register-btn">Register</button>
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
						<img src="/sportpesa_logo_blue.svg" alt="SportPesa" />
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

					<button type="button" className="place-btn" disabled={!betslip.length}>
						Place Bet
					</button>

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
