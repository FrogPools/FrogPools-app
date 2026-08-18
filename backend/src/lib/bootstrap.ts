import { prisma } from './prisma.js';

// Seed demo pools on boot.
// Primary source = REAL Robinhood Chain tokens (with real logos) pulled live from the
// Blockscout explorer, so every pool shows an actual token image (like Delta).
// Fallback = a small invented catalog if the explorer is unreachable.

type Seed = {
  token: string; emoji: string; icon?: string; ca?: string; apr: number; tvl: number; target: number;
  vol7d: number; change24h: number; stage: string; trending?: boolean; isNew?: boolean; feeTier?: number;
};

// ---------- deterministic helpers ----------
function h(s: string): number { let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
function rngFrom(seed: number): () => number { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const slugify = (s: string) => s.toLowerCase().replace(/\$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const truthy = (v: string | undefined) => ['1', 'true', 'yes', 'on'].includes((v || '').toLowerCase());

// believable, stable metrics derived from the token symbol
function deriveMetrics(symbol: string, i: number): Omit<Seed, 'token' | 'emoji' | 'icon'> {
  const r = rngFrom(h(symbol));
  const tvl = Math.round(6000 + r() * 90000);
  const target = Math.max(20000, Math.round((tvl * (1.3 + r() * 1.0)) / 5000) * 5000);
  const apr = Number((14 + r() * 82).toFixed(1));
  const vol7d = Math.round(tvl * (1.1 + r() * 2.8));
  const isNew = r() < 0.4;
  const change24h = Number((isNew ? 8 + r() * 130 : -14 + r() * 64).toFixed(1));
  const stage = r() < 0.1 ? 'filled' : 'open';
  const trending = i < 8 || r() < 0.25;
  const feeTier = r() < 0.25 ? 1.0 : 0.3;
  return { apr, tvl, target, vol7d, change24h, stage, trending, isNew, feeTier };
}

// ---------- REAL tokens from Robinhood Chain (Blockscout) ----------
interface RealToken { symbol: string; name: string; address: string; icon: string; }

const SKIP_SYMBOLS = new Set(['WETH', 'ETH', 'USDG', 'USDE', 'USDC', 'USDT', 'DAI', 'WBTC', 'SYRUPUSDG', 'WBERA']);
const BLOCKSCOUT = 'https://robinhoodchain.blockscout.com/api/v2/tokens?type=ERC-20';

async function fetchRealTokens(limit = 34): Promise<RealToken[]> {
  const out: RealToken[] = [];
  const seen = new Set<string>();
  let url: string | null = BLOCKSCOUT;
  let pages = 0;
  while (url && out.length < limit && pages < 3) {
    pages++;
    let json: any;
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) break;
      json = await res.json();
    } catch { break; }
    const items: any[] = Array.isArray(json?.items) ? json.items : [];
    for (const t of items) {
      const symbol = String(t?.symbol || '').trim();
      const address = String(t?.address || t?.address_hash || '').trim();
      const icon = String(t?.icon_url || '').trim();
      const name = String(t?.name || symbol).trim();
      if (!symbol || !address) continue;
      if (!/^[A-Za-z0-9]{1,14}$/.test(symbol)) continue;
      const key = symbol.toUpperCase();
      if (SKIP_SYMBOLS.has(key) || seen.has(key)) continue;
      if (!icon) continue; // we want pools that actually have a logo
      seen.add(key);
      out.push({ symbol, name, address, icon });
      if (out.length >= limit) break;
    }
    const np = json?.next_page_params;
    if (np && out.length < limit) {
      try { url = BLOCKSCOUT + '&' + new URLSearchParams(np).toString(); } catch { url = null; }
    } else url = null;
  }
  return out;
}

async function createPool(seed: Seed, slug: string): Promise<void> {
  const pool = await prisma.pool.create({
    data: {
      slug, token: seed.token, pair: `${seed.token} / WETH`, emoji: seed.emoji, icon: seed.icon || '', ca: seed.ca || '',
      apr: seed.apr, tvl: seed.tvl, target: seed.target, vol7d: seed.vol7d, change24h: seed.change24h,
      stage: seed.stage, trending: !!seed.trending, isNew: !!seed.isNew, verified: true, feeTier: seed.feeTier ?? 0.3,
    },
  });
  const ADDRS = ['0x..f495', '0x..3e7d', '0x..f9f9', '0x..a1c8', '0x..77e2', '0x..60af', '0x..7a09', '0x..5786', '0x..70f4', '0x..1999'];
  const VERBS = ['staked', 'compounded', 'claimed', 'staked', 'unstaked'];
  const rnd = (seed2: number) => { const x = Math.sin(seed2) * 10000; return x - Math.floor(x); };
  for (let i = 0; i < 3; i++) {
    const verb = VERBS[Math.floor(rnd(pool.slug.length + i) * VERBS.length)];
    const amt = verb === 'claimed' ? `${(rnd(i + 1) * 0.1).toFixed(4)} WETH`
      : verb === 'compounded' ? `+$${(rnd(i + 2) * 9 + 1).toFixed(1)}k depth`
      : `${(rnd(i + 3) * 5 + 0.5).toFixed(2)} LP`;
    await prisma.activity.create({
      data: {
        poolId: pool.id, address: ADDRS[Math.floor(rnd(i + pool.slug.length) * ADDRS.length)],
        verb, amount: amt,
        valueUsd: verb === 'compounded' ? '' : `$${Math.round(rnd(i + 5) * 3000 + 100).toLocaleString('en-US')}`,
        trigger: verb === 'compounded' ? (i % 2 ? 'router · milestone' : 'router · auto') : 'wallet',
      },
    });
  }
}

async function seedRealTokens(tokens: RealToken[]): Promise<void> {
  const usedSlugs = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const token = tk.symbol.startsWith('$') ? tk.symbol : `$${tk.symbol}`;
    let slug = slugify(`${tk.symbol} / WETH`);
    if (!slug || usedSlugs.has(slug)) continue;
    usedSlugs.add(slug);
    const m = deriveMetrics(tk.symbol, i);
    await createPool({ token, emoji: '', icon: tk.icon, ca: tk.address, ...m }, slug);
  }
}

// ---------- fallback invented catalog (only if the explorer is unreachable) ----------
const FALLBACK: Seed[] = [
  { token: '$LILYPAD', emoji: '🪷', icon: 'assets/memes/02-realfrog.png', apr: 42.6, tvl: 68400, target: 100000, vol7d: 190000, change24h: 12.4, stage: 'open', trending: true },
  { token: '$SWAMP', emoji: '💧', icon: 'assets/memes/06-superhero.png', apr: 61.2, tvl: 80000, target: 80000, vol7d: 142000, change24h: 35.5, stage: 'filled', trending: true },
  { token: '$DROPLET', emoji: '🐸', icon: 'assets/memes/01-droplet-poolstrade.png', apr: 28.4, tvl: 31700, target: 40000, vol7d: 88000, change24h: 15.4, stage: 'open', trending: true },
  { token: '$FLYCATCH', emoji: '🐝', icon: 'assets/memes/08-htz.png', apr: 88.1, tvl: 12300, target: 30000, vol7d: 64000, change24h: 143.9, stage: 'open', trending: true, isNew: true },
  { token: '$POSSUM', emoji: '🐖', icon: 'assets/memes/04-fox-hood.png', apr: 54.7, tvl: 18900, target: 30000, vol7d: 52000, change24h: 43.4, stage: 'open', trending: true, isNew: true },
  { token: '$PEGASUS', emoji: '🦄', icon: 'assets/memes/07-pegasus.png', apr: 33.8, tvl: 28000, target: 40000, vol7d: 41000, change24h: 26.7, stage: 'open', isNew: true },
  { token: '$GOAT', emoji: '🐐', icon: 'assets/memes/09-goat.png', apr: 47.3, tvl: 24000, target: 40000, vol7d: 38000, change24h: 51.7, stage: 'open', trending: true, isNew: true },
  { token: '$HOOKR', emoji: '🔥', icon: 'assets/memes/05-h4-pink.png', apr: 72.4, tvl: 16500, target: 30000, vol7d: 33000, change24h: 18.2, stage: 'open', isNew: true, feeTier: 1.0 },
  { token: '$FLIPFLAP', emoji: '🐕', icon: 'assets/memes/03-froge-doge.png', apr: 31.0, tvl: 9800, target: 20000, vol7d: 21000, change24h: -6.6, stage: 'open', isNew: true },
];

async function seedFallback(): Promise<void> {
  for (const p of FALLBACK) await createPool(p, slugify(`${p.token} / WETH`));
}

async function wipeCatalog(): Promise<void> {
  await prisma.activity.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.pool.deleteMany({});
}

// ensureIcons kept for API compatibility (real icons now come straight from the seed).
export async function ensureIcons(): Promise<void> { /* no-op: icons are set at seed time */ }

// Make sure the `ca` (contract address) column exists — safe idempotent DDL so we
// don't need a Prisma migration or a full reseed to add it.
export async function ensureCaColumn(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "ca" TEXT NOT NULL DEFAULT \'\';');
  } catch (e) {
    console.warn('[bootstrap] ensureCaColumn failed', e);
  }
}

// Backfill contract addresses for existing pools (match Blockscout token by symbol),
// so buy/explorer links work without wiping the catalog.
async function backfillCa(): Promise<void> {
  try {
    const pools = await prisma.pool.findMany({ where: { ca: '' }, select: { id: true, token: true } });
    if (!pools.length) return;
    const tokens = await fetchRealTokens(60);
    if (!tokens.length) return;
    const bySym = new Map(tokens.map((t) => [t.symbol.toUpperCase(), t.address]));
    let n = 0;
    for (const p of pools) {
      const sym = (p.token || '').replace(/\$/g, '').trim().toUpperCase();
      const addr = bySym.get(sym);
      if (addr) { await prisma.pool.update({ where: { id: p.id }, data: { ca: addr } }); n++; }
    }
    if (n) console.log(`[bootstrap] backfilled ca for ${n} pools`);
  } catch (e) {
    console.warn('[bootstrap] backfillCa skipped', e);
  }
}

/**
 * Boot seeding:
 *  - RESEED=1  -> wipe the catalog and reseed from live Robinhood Chain tokens (real logos).
 *  - empty DB  -> seed from live tokens (fallback to invented catalog if the explorer is down).
 *  - otherwise -> leave the existing catalog untouched.
 */
export async function ensureSeed(): Promise<void> {
  await ensureCaColumn(); // must run before any full Pool select (routes select `ca`)
  const reseed = truthy(process.env.RESEED);
  const count = await prisma.pool.count();

  if (reseed) {
    const tokens = await fetchRealTokens(34);
    if (tokens.length >= 8) {
      await wipeCatalog();
      await seedRealTokens(tokens);
      console.log(`[bootstrap] RESEED: wiped catalog, seeded ${tokens.length} real Robinhood Chain tokens (with logos)`);
      return;
    }
    console.warn('[bootstrap] RESEED requested but token fetch returned too few tokens; leaving catalog as-is');
    if (count > 0) return;
  }

  if (count > 0) { await backfillCa(); return; } // catalog present: fill missing contract addresses

  // empty DB: prefer real tokens, fall back to invented
  const tokens = await fetchRealTokens(34);
  if (tokens.length >= 8) {
    await seedRealTokens(tokens);
    console.log(`[bootstrap] seeded ${tokens.length} real Robinhood Chain tokens on first boot`);
  } else {
    await seedFallback();
    console.log(`[bootstrap] explorer unreachable; seeded ${FALLBACK.length} fallback pools`);
  }
}
