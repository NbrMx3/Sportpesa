# Sportpesa Server API

This backend implements the core modules of a betting platform:

1. Authentication (signup/login, bcrypt, JWT)
2. User account (profile, balance, transactions)
3. Wallet/payment (deposit, withdraw, M-Pesa-style deposit flow)
4. Match and odds (match feed and odds APIs)
5. Betting engine (bet slip, locked odds, potential win calculation)
6. Live betting (Socket.io real-time odds updates)
7. Result processing (settle bets as won/lost)
8. Payouts (credit winners)
9. Admin APIs (users, bets, fraud signals, odds adjustments)

Data persistence is powered by PostgreSQL (Neon compatible) using `pg`.

Authentication supports:

- Signup/login with `email` or `phoneNumber`
- Password hashing with `bcrypt`
- JWT access tokens and refresh tokens
- Refresh and logout token endpoints

## Quick start

1. Install dependencies:

```bash
cd server
npm install
```

2. Copy environment values:

```bash
copy .env.example .env
```

3. Set `DATABASE_URL` in `.env` to your Neon/PostgreSQL connection string.

4. Run in development mode:

```bash
npm run dev
```

Server base URL: `http://localhost:5000`

Health check: `GET /api/health`

## Render deployment

If deploying on Render, set these Environment Variables in the Web Service:

- `DATABASE_URL` (preferred), or one of: `POSTGRES_URL`, `POSTGRESQL_URL`, `NEON_DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_ORIGIN` (your Vercel frontend URL)

You can set multiple allowed CORS origins using commas:

- `CLIENT_ORIGIN=http://localhost:5173,https://your-app.vercel.app`

If `DATABASE_URL` is missing, startup will fail by design to prevent running without a database.

## Default admin login

- Email: `admin@sportpesa.local`
- Password: `Admin123!`

## Example betting formula

Potential win is calculated as:

`Bet Amount x Combined Odds = Potential Win`

Example: `100 KES x 2.5 = 250 KES`

## Main API endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/users/me`
- `GET /api/users/me/transactions`
- `POST /api/wallet/deposit`
- `POST /api/wallet/withdraw`
- `GET /api/matches`
- `GET /api/odds`
- `GET /api/football/matches` (external football feed)
- `GET /api/football/odds` (external football odds)
- `PATCH /api/matches/:matchId/odds` (admin)
- `POST /api/bets`
- `GET /api/bets/my`
- `POST /api/results` (admin)
- `POST /api/payouts/:betId`
- `GET /api/payouts`
- `GET /api/admin/users` (admin)
- `GET /api/admin/bets` (admin)
- `GET /api/admin/fraud-signals` (admin)

## External football providers

This server can fetch football fixtures and odds from:

- ClearSports API (preferred first)
- Odds-API.io (fallback)

Configure provider credentials in `.env`:

- `CLEARSPORTS_API_KEY`
- `ODDS_API_KEY`

Optional paths/base URLs are listed in `.env.example`.

To fetch broader same-day fixtures, configure:

- `FOOTBALL_LEAGUES` (comma-separated leagues to query in addition to `FOOTBALL_LEAGUE`)
- `FOOTBALL_MAX_MATCHES` (maximum number of matches returned)

Both football feed endpoints also accept optional query params:

- `date=YYYY-MM-DD`
- `from=<ISO timestamp>`
- `to=<ISO timestamp>`
- `limit=<number>`

## Vercel deployment notes

Root `vercel.json` includes rewrites that proxy:

- `/api/*` -> `https://sportpesa.onrender.com/api/*`
- `/socket.io/*` -> `https://sportpesa.onrender.com/socket.io/*`

If your Render API URL is different, update `vercel.json` accordingly.

## Socket.io events

- `odds:snapshot` (on connect)
- `odds:update` (polled from the same live football feed used by `/api/matches` and `/api/odds`)

`LIVE_ODDS_REFRESH_MS` controls the Socket.io refresh interval and defaults to `10000`.
