import { prisma } from './prisma.js';

// Auto-seed demo pools on first boot when the DB is empty.
// Keeps Railway deploys one-step (no manual seed). Local dev can still use `npm run db:seed`.

type Seed = {
  token: string; emoji: string; apr: number; tvl: number; target: number;
  vol7d: number; change24h: number; stage: string; trending?: boolean; isNew?: boolean; feeTier?: number;
};

// --- flagship pools (hand-tuned numbers + real meme art) ---
const CURATED: Seed[] = [
  { token: '$LILYPAD', emoji: '🪷', apr: 42.6, tvl: 68400, target: 100000, vol7d: 190000, change24h: 12.4, stage: 'open', trending: true },
  { token: '$SWAMP', emoji: '💧', apr: 61.2, tvl: 80000, target: 80000, vol7d: 142000, change24h: 35.5, stage: 'filled', trending: true },
  { token: '$DROPLET', emoji: '🐸', apr: 28.4, tvl: 31700, target: 40000, vol7d: 88000, change24h: 15.4, stage: 'open', trending: true },
  { token: '$FLYCATCH', emoji: '🐝', apr: 88.1, tvl: 12300, target: 30000, vol7d: 64000, change24h: 143.9, stage: 'open', trending: true, isNew: true },
  { token: '$POSSUM', emoji: '🐖', apr: 54.7, tvl: 18900, target: 30000, vol7d: 52000, change24h: 43.4, stage: 'open', trending: true, isNew: true },
  { token: '$PEGASUS', emoji: '🦄', apr: 33.8, tvl: 28000, target: 40000, vol7d: 41000, change24h: 26.7, stage: 'open', isNew: true },
  { token: '$GOAT', emoji: '🐐', apr: 47.3, tvl: 24000, target: 40000, vol7d: 38000, change24h: 51.7, stage: 'open', trending: true, isNew: true },
  { token: '$HOOKR', emoji: '🔥', apr: 72.4, tvl: 16500, target: 30000, vol7d: 33000, change24h: 18.2, stage: 'open', isNew: true, feeTier: 1.0 },
  { token: '$FLIPFLAP', emoji: '🐕', apr: 31.0, tvl: 9800, target: 20000, vol7d: 21000, change24h: -6.6, stage: 'open', isNew: true },
  { token: '$UNIFROG', emoji: '🐸', apr: 44.8, tvl: 14800, target: 30000, vol7d: 19000, change24h: 7.0, stage: 'open', isNew: true },
  { token: '$CHOWDER', emoji: '🍲', apr: 39.1, tvl: 11200, target: 20000, vol7d: 15000, change24h: 9.2, stage: 'open', isNew: true },
  { token: '$HOODMKT', emoji: '👑', apr: 22.1, tvl: 41000, target: 60000, vol7d: 28000, change24h: 4.1, stage: 'open' },
];

// --- long-tail catalog (procedurally sized, unique generated avatars on the frontend) ---
// Only names/emoji/flags are curated; believable metrics are derived deterministically
// from the token symbol so the list is varied but stable across reseeds.
const EXTRA: Array<{ token: string; emoji: string; trending?: boolean; isNew?: boolean; feeTier?: number }> = [
  { token: '$RIBBIT', emoji: '🐸', trending: true },
  { token: '$TADPOLE', emoji: '🌱', isNew: true },
  { token: '$CROAK', emoji: '🗣️' },
  { token: '$POND', emoji: '🏞️', trending: true },
  { token: '$NEWT', emoji: '🦎', isNew: true },
  { token: '$BULLFROG', emoji: '🐮', trending: true },
  { token: '$GREENIE', emoji: '💚', isNew: true },
  { token: '$HOPPER', emoji: '🦗' },
  { token: '$MARSH', emoji: '🌾', isNew: true },
  { token: '$BAYOU', emoji: '🛶' },
  { token: '$GATOR', emoji: '🐊', trending: true },
  { token: '$HERON', emoji: '🦆', isNew: true },
  { token: '$DRAGONFLY', emoji: '🪰', feeTier: 1.0 },
  { token: '$CATTAIL', emoji: '🌿', isNew: true },
  { token: '$MUDSKIP', emoji: '🐟' },
  { token: '$PADDY', emoji: '🍚', isNew: true },
  { token: '$REEDS', emoji: '🍃' },
  { token: '$GILL', emoji: '🐠', trending: true },
  { token: '$SPLASH', emoji: '💦', isNew: true },
  { token: '$WADER', emoji: '🥾' },
  { token: '$QUAG', emoji: '🪵', isNew: true },
  { token: '$SLOUGH', emoji: '🌊' },
  { token: '$FROGGO', emoji: '🐸', trending: true, isNew: true },
  { token: '$TOADIE', emoji: '🤢', isNew: true },
];

// FNV-1a hash → stable seed per symbol.
function h(s: string): number {
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function derive(e: { token: string; emoji: string; trending?: boolean; isNew?: boolean; feeTier?: number }): Seed {
  const r = rngFrom(h(e.token));
  const tvl = Math.round(3000 + r() * 34000);
  const targetRaw = tvl * (1.3 + r() * 1.1);
  const target = Math.max(10000, Math.round(targetRaw / 5000) * 5000);
  const apr = Number((14 + r() * 78).toFixed(1));
  const vol7d = Math.round(tvl * (1.1 + r() * 2.6));
  const change24h = Number((e.isNew ? 10 + r() * 130 : -12 + r() * 60).toFixed(1));
  const stage = r() < 0.08 ? 'filled' : 'open';
  return { token: e.token, emoji: e.emoji, apr, tvl, target, vol7d, change24h, stage, trending: e.trending, isNew: e.isNew, feeTier: e.feeTier };
}

const POOLS: Seed[] = CURATED.concat(EXTRA.map(derive));

// icon assignment lives on the backend — the API decides which avatar each pool shows.
// Only the flagship pools get real meme art; the long tail renders a vibrant, unique
// generated avatar on the frontend (from its emoji + a hue derived from the symbol).
const ICONS: Record<string, string> = {
  'lilypad-weth': 'assets/memes/02-realfrog.png',
  'swamp-weth': 'assets/memes/06-superhero.png',
  'droplet-weth': 'assets/memes/01-droplet-poolstrade.png',
  'flycatch-weth': 'assets/memes/08-htz.png',
  'possum-weth': 'assets/memes/04-fox-hood.png',
  'pegasus-weth': 'assets/memes/07-pegasus.png',
  'goat-weth': 'assets/memes/09-goat.png',
  'hookr-weth': 'assets/memes/05-h4-pink.png',
  'flipflap-weth': 'assets/memes/03-froge-doge.png',
  'unifrog-weth': 'assets/memes/02-realfrog.png',
  'chowder-weth': 'assets/memes/06-superhero.png',
  'hoodmkt-weth': 'assets/memes/08-htz.png',
};

const slugify = (s: string) => s.toLowerCase().replace(/\$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Backfill icons for existing pools whose icon is empty (runs on every boot; cheap).
export async function ensureIcons(): Promise<void> {
  for (const slug in ICONS) {
    await prisma.pool.updateMany({ where: { slug, icon: '' }, data: { icon: ICONS[slug] } });
  }
}

const rnd = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
const ADDRS = ['0x..f495', '0x..3e7d', '0x..f9f9', '0x..a1c8', '0x..77e2', '0x..60af', '0x..7a09', '0x..5786', '0x..70f4', '0x..1999'];
const VERBS = ['staked', 'compounded', 'claimed', 'staked', 'unstaked'];

async function createPoolWithActivity(p: Seed, slug: string): Promise<void> {
  const pair = `${p.token} / WETH`;
  const pool = await prisma.pool.create({
    data: {
      slug, token: p.token, pair, emoji: p.emoji, icon: ICONS[slug] || '',
      apr: p.apr, tvl: p.tvl, target: p.target, vol7d: p.vol7d, change24h: p.change24h,
      stage: p.stage, trending: !!p.trending, isNew: !!p.isNew, verified: true, feeTier: p.feeTier ?? 0.3,
    },
  });
  for (let i = 0; i < 3; i++) {
    const verb = VERBS[Math.floor(rnd(pool.slug.length + i) * VERBS.length)];
    const amt = verb === 'claimed' ? `${(rnd(i + 1) * 0.1).toFixed(4)} WETH`
      : verb === 'compounded' ? `+$${(rnd(i + 2) * 9 + 1).toFixed(1)}k depth`
      : `${(rnd(i + 3) * 5 + 0.5).toFixed(2)} LP`;
    await prisma.activity.create({
      data: {
        poolId: pool.id,
        address: ADDRS[Math.floor(rnd(i + pool.slug.length) * ADDRS.length)],
        verb, amount: amt,
        valueUsd: verb === 'compounded' ? '' : `$${Math.round(rnd(i + 5) * 3000 + 100).toLocaleString('en-US')}`,
        trigger: verb === 'compounded' ? (i % 2 ? 'router · milestone' : 'router · auto') : 'wallet',
      },
    });
  }
}

// Idempotent: ensures every catalog pool exists. Creates any that are missing
// (with a little starter activity) and NEVER overwrites pools already in the DB,
// so redeploys can grow the catalog without wiping live/drifted numbers.
export async function ensureSeed(): Promise<void> {
  const existing = await prisma.pool.findMany({ select: { slug: true } });
  const have = new Set(existing.map((e) => e.slug));
  let created = 0;
  for (const p of POOLS) {
    const slug = slugify(`${p.token} / WETH`);
    if (have.has(slug)) continue;
    await createPoolWithActivity(p, slug);
    created++;
  }
  if (created > 0) console.log(`[bootstrap] added ${created} pool(s) (catalog now ${POOLS.length})`);
}
