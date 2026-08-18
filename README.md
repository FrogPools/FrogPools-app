<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:8CBE1B,100:B6E63A&height=190&section=header&text=FrogPools&fontColor=ffffff&fontSize=64&fontAlignY=38&desc=Marketplace%20and%20launchpad%20for%20pools.trade%20pools&descAlignY=60&descSize=16" width="100%" alt="FrogPools" />

![Status](https://img.shields.io/badge/status-beta-8CBE1B?style=flat-square&labelColor=10160B)
![Frontend](https://img.shields.io/badge/frontend-Vercel-000000?style=flat-square&logo=vercel)
![Backend](https://img.shields.io/badge/backend-Railway-0B0D0E?style=flat-square&logo=railway)
![Chain](https://img.shields.io/badge/chain-Robinhood-8CBE1B?style=flat-square&labelColor=10160B)
![License](https://img.shields.io/badge/license-MIT-8CBE1B?style=flat-square&labelColor=10160B)

</div>

## Overview

**FrogPools** is the fast marketplace and launchpad for **pools.trade** pools. Discover trending pools,
stake for a real share of swap fees in WETH, trade, or launch your own — self-custodial, on Robinhood Chain.
Staking and an automated **router** (which compounds fees back into pool depth) are features inside every pool.

## Features

- 🔎 **Explore** - spotlight, trending big-cards, live activity feed, price ticker.
- 🗂 **Collections** — every pool in a filterable grid (open / trending / new · top-APR / TVL / 24h fees).
- 📈 **Trending** — ranked table with APR, TVL, 24h, 7-day fees and sparklines.
- ⚡ **Activity** — full stakes / router / claims feed.
- 🚀 **Launch** — turn any pair into a live pool in minutes.
- 💧 **Real yield** — rewards are a share of actual swap fees in WETH, not emissions.

## Monorepo structure

```
.
├── web/                 # static frontend (deploy: Vercel)
│   ├── index.html       # landing
│   ├── app.html         # Explore
│   ├── collections.html · trending.html · activity.html · launch.html
│   ├── app.css · app-shell.js
│   └── assets/
└── backend/             # off-chain API (deploy: Railway)
    ├── src/             # Fastify server + routes + SIWE auth
    ├── prisma/          # schema + seed
    └── package.json
```

## Quick start

### Backend

```bash
cd backend
cp .env.example .env          # fill DATABASE_URL + JWT_SECRET
npm install
npm run prisma:generate
npm run db:push               # create tables
npm run db:seed               # load demo pools + activity
npm run dev                   # http://localhost:8080/health
```

### Frontend

```bash
cd web
python3 -m http.server 8099   # or any static server → http://localhost:8099
```

Point the frontend at the API by setting the base URL to your backend (local or the Railway URL).

## Deploy

| Part | Where | Notes |
|------|-------|-------|
| **web** | Vercel | Root directory `web`, static — no build step. |
| **backend** | Railway | Root directory `backend` + a PostgreSQL plugin. Start command: `npx prisma db push && npm run build && npm start`. Set `DATABASE_URL`, `JWT_SECRET`, `SIWE_DOMAIN`, `CORS_ORIGINS`. |

## API (milestone 1)

| Method | Route | Auth | Purpose |
|--------|-------|:----:|---------|
| GET | `/health` | — | liveness |
| GET | `/api/pools` | — | list pools (`?sort=apr\|tvl\|vol&filter=all\|open\|trending\|new`) |
| GET | `/api/pools/:slug` | — | one pool + recent activity |
| GET | `/api/trending` | — | trending pools |
| GET | `/api/activity` | — | live feed (`?kind=all\|stakes\|router\|claims`) |
| GET | `/api/auth/nonce` | — | SIWE nonce for `?address=` |
| POST | `/api/auth/verify` | — | verify SIWE → JWT |
| GET | `/api/me` · `/api/me/positions` | 🔑 | account + positions (with accrued fees) |
| POST | `/api/pools/:slug/stake` · `/unstake` · `/claim` | 🔑 | staking loop |
| POST | `/api/launch` | 🔑 | create a pool |

## Roadmap

- **Phase A - off-chain demo** *(this repo)*: real wallet sign-in (SIWE), pools/stakes/activity in Postgres, live feeds.
- **Phase B - on-chain**: Solidity staking + auto-router on Robinhood Chain, called from the frontend via viem/wagmi.

## Disclaimer

Independent marketplace & launchpad for pools.trade pools on Robinhood Chain. Not affiliated with Uniswap,
pools.trade or Robinhood. Rewards come from real trading fees, not emissions - trading, staking and launching
involve smart-contract and market risk. Not financial advice.

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:B6E63A,100:8CBE1B&height=110&section=footer" width="100%" alt="" />
</div>
