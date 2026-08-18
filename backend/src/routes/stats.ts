import type { FastifyInstance } from 'fastify';
import { prisma, WETH_USD } from '../lib/prisma.js';

// Global marketplace stats — powers the Explore hero ("Live pools" / "Total staked")
// and any stat strip. TVL/volume live on the Pool rows (seeded + moved by the simulator),
// so these totals are real aggregates over ALL pools, not just the current page.
export async function statsRoutes(app: FastifyInstance) {
  app.get('/api/stats', async () => {
    const [agg, totalPools, openPools, realStakers] = await Promise.all([
      prisma.pool.aggregate({ _sum: { tvl: true, vol7d: true }, _avg: { apr: true } }),
      prisma.pool.count(),
      prisma.pool.count({ where: { stage: 'open' } }),
      prisma.position.count({ where: { valueUsd: { gt: 0 } } }),
    ]);

    const tvl = agg._sum.tvl ?? 0;
    const vol7d = agg._sum.vol7d ?? 0;
    const avgApr = agg._avg.apr ?? 0;

    // believable staker count: derived from TVL + any real (signed-in) positions
    const stakers = Math.round(tvl / 1600) + realStakers;

    return {
      pools: totalPools,
      openPools,
      tvlUsd: Math.round(tvl),
      vol7dUsd: Math.round(vol7d),
      avgApr: Number(avgApr.toFixed(1)),
      stakers,
      wethUsd: WETH_USD,
      token: { symbol: '$FROG', status: 'soon' },
      ts: Date.now(),
    };
  });
}
