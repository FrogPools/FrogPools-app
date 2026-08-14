import { prisma } from './prisma.js';
import { WETH_USD } from './prisma.js';

/**
 * Activity simulator (demo).
 * Periodically inserts believable activity events and gently nudges pool metrics,
 * so the feed and numbers move on their own — the site "breathes" without real on-chain traffic.
 * Bounded: pool metrics are clamped to sane ranges and the activity table is pruned to ~200 rows.
 * Toggle via env: SIM_ENABLED=false to disable, SIM_INTERVAL_MS to change cadence.
 */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const hexShort = () => '0x..' + Math.floor(rnd(0, 0xffff)).toString(16).padStart(4, '0');
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const kUsd = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

let timer: ReturnType<typeof setInterval> | null = null;

export function startSimulator(): void {
  const enabled = (process.env.SIM_ENABLED ?? 'true') !== 'false';
  if (!enabled) return;
  const interval = Math.max(2000, Number(process.env.SIM_INTERVAL_MS ?? '9000'));
  if (timer) clearInterval(timer);
  timer = setInterval(() => { tick().catch(() => {}); }, interval);
  // fire one shortly after boot so the feed looks fresh immediately
  setTimeout(() => { tick().catch(() => {}); }, 2500);
}

async function tick(): Promise<void> {
  const pools = await prisma.pool.findMany();
  if (!pools.length) return;
  const pool = pick(pools);
  const r = Math.random();

  let verb: string, amount: string, valueUsd: string, trigger: string;
  let dTvl = 0, dVol = 0;

  if (r < 0.5) {
    // staked
    const v = Math.round(rnd(120, 6000));
    verb = 'staked'; amount = `${(v / 500).toFixed(2)} LP`; valueUsd = usd(v); trigger = 'wallet';
    dTvl = v; dVol = rnd(200, 1200);
  } else if (r < 0.8) {
    // router compounding
    const depth = Math.round(rnd(800, 9000));
    verb = 'compounded'; amount = `+${kUsd(depth)} depth`; valueUsd = '—';
    trigger = Math.random() < 0.3 ? 'router · milestone' : 'router · auto';
    dTvl = depth * 0.4; dVol = depth;
  } else if (r < 0.92) {
    // claimed fees
    const w = rnd(0.005, 0.09);
    verb = 'claimed'; amount = `${w.toFixed(4)} WETH`; valueUsd = usd(w * WETH_USD); trigger = 'wallet';
    dVol = rnd(100, 600);
  } else {
    // unstaked
    const v = Math.round(rnd(100, 3000));
    verb = 'unstaked'; amount = `${(v / 500).toFixed(2)} LP`; valueUsd = usd(v); trigger = 'wallet';
    dTvl = -v;
  }

  // absolute, clamped metric updates (no runaway drift)
  const nextTvl = Math.max(0, pool.tvl + dTvl);
  const nextVol = Math.max(0, pool.vol7d + dVol);
  const nextChange = clamp(pool.change24h + rnd(-0.6, 0.8), -25, 180);
  const nextApr = clamp(pool.apr + rnd(-0.3, 0.35), 3, 140);

  try {
    await prisma.$transaction([
      prisma.activity.create({ data: { poolId: pool.id, address: hexShort(), verb, amount, valueUsd, trigger } }),
      prisma.pool.update({ where: { id: pool.id }, data: { tvl: nextTvl, vol7d: nextVol, change24h: nextChange, apr: nextApr } }),
    ]);
  } catch (_) { /* ignore transient errors */ }

  // prune the activity table so it never grows unbounded
  try {
    const count = await prisma.activity.count();
    if (count > 220) {
      const old = await prisma.activity.findMany({ orderBy: { createdAt: 'asc' }, take: count - 200, select: { id: true } });
      if (old.length) await prisma.activity.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
  } catch (_) { /* ignore */ }
}
