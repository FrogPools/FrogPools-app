import { prisma } from './prisma.js';

// Auto-seed demo pools on first boot when the DB is empty.
// Keeps Railway deploys one-step (no manual seed). Local dev can still use `npm run db:seed`.
const POOLS = [
  { token: '$LILYPAD', emoji: '🪷', apr: 42.6, tvl: 68400, target: 100000, vol7d: 190000, change24h: 12.4, stage: 'open', trending: true },
  { token: '$SWAMP', emoji: '💧', apr: 61.2, tvl: 80000, target: 80000, vol7d: 142000, change24h: 35.5, stage: 'filled', trending: true },
  { token: '$DROPLET', emoji: '🐸', apr: 28.4, tvl: 31700, target: 40000, vol7d: 88000, change24h: 15.4, stage: 'open', trending: true },
  { token: '$FLYCATCH', emoji: '🐝', apr: 88.1, tvl: 12300, target: 30000, vol7d: 64000, change24h: 143.9, stage: 'open', trending: true, isNew: true },
  { token: '$POSSUM', emoji: '🐖', apr: 54.7, tvl: 18900, target: 30000, vol7d: 52000, change24h: 43.4, stage: 'open', trending: true, isNew: true },
  { token: '$PEGASUS', emoji: '🦄', apr: 33.8, tvl: 28000, target: 40000, vol7d: 41000, change24h: 26.7, stage: 'open', isNew: true },
  { token: '$GOAT', emoji: '🐐', apr: 47.3, tvl: 24000, target: 40000, vol7d: 38000, change24h: 51.7, stage: 'open', trending: true, isNew: true },
  { token: '$HOOKR', emoji: '🔥', apr: 72.4, tvl: 16500, target: 30000, vol7d: 33000, change24h: 18.2, stage: 'open', isNew: true },
  { token: '$FLIPFLAP', emoji: '🐕', apr: 31.0, tvl: 9800, target: 20000, vol7d: 21000, change24h: -6.6, stage: 'open', isNew: true },
  { token: '$UNIFROG', emoji: '🐸', apr: 44.8, tvl: 14800, target: 30000, vol7d: 19000, change24h: 7.0, stage: 'open', isNew: true },
  { token: '$CHOWDER', emoji: '🍲', apr: 39.1, tvl: 11200, target: 20000, vol7d: 15000, change24h: 9.2, stage: 'open', isNew: true },
  { token: '$HOODMKT', emoji: '👑', apr: 22.1, tvl: 41000, target: 60000, vol7d: 28000, change24h: 4.1, stage: 'open' },
];

const slugify = (s: string) => s.toLowerCase().replace(/\$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const rnd = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
const ADDRS = ['0x..f495', '0x..3e7d', '0x..f9f9', '0x..a1c8', '0x..77e2', '0x..60af', '0x..7a09', '0x..5786', '0x..70f4', '0x..1999'];
const VERBS = ['staked', 'compounded', 'claimed', 'staked', 'unstaked'];

export async function ensureSeed(): Promise<void> {
  const count = await prisma.pool.count();
  if (count > 0) return;
  for (const p of POOLS) {
    const pair = `${p.token} / WETH`;
    const pool = await prisma.pool.create({
      data: {
        slug: slugify(pair), token: p.token, pair, emoji: p.emoji,
        apr: p.apr, tvl: p.tvl, target: p.target, vol7d: p.vol7d, change24h: p.change24h,
        stage: p.stage, trending: !!(p as any).trending, isNew: !!(p as any).isNew, verified: true, feeTier: 0.3,
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
  console.log(`[bootstrap] seeded ${POOLS.length} pools on first boot`);
}
