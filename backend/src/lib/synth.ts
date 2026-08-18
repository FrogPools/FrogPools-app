import { WETH_USD } from './prisma.js';

// Demo: 1 LP unit ≈ $500 (must match routes/me.ts LP_PRICE so numbers reconcile).
const LP_PRICE = 500;

// FNV-1a string hash → 32-bit unsigned seed.
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — tiny deterministic PRNG. Same seed → same sequence every call,
// so a pool's staker board is STABLE across polls (doesn't reshuffle every 10s).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fakeShortAddr(rand: () => number): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 4; i++) s += hex[Math.floor(rand() * 16)];
  return '0x..' + s;
}

export interface StakerRow {
  address: string;
  valueUsd: number;
  lp: number;
  sharePct: number;
  feesWeth: number;
  you?: boolean;
}

export interface RealPos {
  address: string; // already shortened (e.g. "0x..1a2b")
  valueUsd: number;
  lp: number;
}

/**
 * Build a believable, deterministic (stable per slug) staker leaderboard for a pool,
 * scaled to the pool's CURRENT tvl, with any real positions merged in on top.
 * Used by GET /api/pools/:slug/stakers so the "Stakers" tab is API-driven, not
 * random in the browser.
 */
export function buildStakers(opts: {
  slug: string;
  tvl: number;
  apr: number;
  real?: RealPos[];
  limit?: number;
}): { items: StakerRow[]; count: number } {
  const tvl = Math.max(0, opts.tvl);
  const apr = Math.max(0, opts.apr);
  const real = (opts.real ?? []).filter((r) => r.valueUsd > 0);
  const limit = opts.limit ?? 25;

  // total believable staker count grows with TVL, bounded
  const totalCount = Math.min(80, Math.max(6, Math.round(tvl / 1500)));
  const synthCount = Math.max(0, totalCount - real.length);

  const rand = mulberry32(hashStr(opts.slug));

  // Zipf-ish decaying weights: first holder is a whale, tail small but non-zero.
  const weights: number[] = [];
  let wsum = 0;
  for (let i = 0; i < synthCount; i++) {
    const base = 1 / Math.pow(i + 1, 0.85);
    const jitter = 0.7 + rand() * 0.6; // ±~30%
    const w = base * jitter;
    weights.push(w);
    wsum += w;
  }

  // real positions already occupy part of the TVL; synthetic holders share the rest
  const realValue = real.reduce((s, r) => s + Math.max(0, r.valueUsd), 0);
  const synthBudget = Math.max(0, tvl - realValue);

  const rows: StakerRow[] = [];

  for (let i = 0; i < synthCount; i++) {
    const valueUsd = wsum > 0 ? (weights[i] / wsum) * synthBudget : 0;
    const lp = valueUsd / LP_PRICE;
    const feeFrac = 0.02 + rand() * 0.22; // ~1 week … ~3 months of accrued yield
    const feesWeth = (valueUsd * (apr / 100) * feeFrac) / WETH_USD;
    rows.push({ address: fakeShortAddr(rand), valueUsd, lp, sharePct: 0, feesWeth });
  }

  for (const r of real) {
    const valueUsd = Math.max(0, r.valueUsd);
    const feesWeth = (valueUsd * (apr / 100) * 0.12) / WETH_USD;
    rows.push({ address: r.address, valueUsd, lp: r.lp, sharePct: 0, feesWeth, you: true });
  }

  rows.sort((a, b) => b.valueUsd - a.valueUsd);

  const denom = tvl > 0 ? tvl : rows.reduce((s, r) => s + r.valueUsd, 0) || 1;
  const items = rows.slice(0, limit).map((r) => ({
    address: r.address,
    valueUsd: Math.round(r.valueUsd),
    lp: Number(r.lp.toFixed(2)),
    sharePct: Number(((r.valueUsd / denom) * 100).toFixed(2)),
    feesWeth: Number(r.feesWeth.toFixed(6)),
    ...(r.you ? { you: true } : {}),
  }));

  return { items, count: totalCount };
}
