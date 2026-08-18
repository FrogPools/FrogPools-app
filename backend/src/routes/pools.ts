import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { buildStakers } from '../lib/synth.js';

const listQuery = z.object({
  sort: z.enum(['apr', 'tvl', 'vol']).default('apr'),
  filter: z.enum(['all', 'open', 'trending', 'new']).default('all'),
  q: z.string().trim().max(40).optional(), // free-text search on token / pair
  limit: z.coerce.number().min(1).max(100).default(24),
  page: z.coerce.number().min(1).default(1),
});

const orderBy = { apr: { apr: 'desc' }, tvl: { tvl: 'desc' }, vol: { vol7d: 'desc' } } as const;

export async function poolRoutes(app: FastifyInstance) {
  app.get('/api/pools', async (req) => {
    const q = listQuery.parse(req.query);
    const base =
      q.filter === 'open' ? { stage: 'open' } :
      q.filter === 'trending' ? { trending: true } :
      q.filter === 'new' ? { isNew: true } : {};
    const search =
      q.q && q.q.length
        ? {
            OR: [
              { token: { contains: q.q, mode: 'insensitive' as const } },
              { pair: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {};
    const where = { ...base, ...search };
    const [items, total] = await Promise.all([
      prisma.pool.findMany({
        where,
        orderBy: orderBy[q.sort],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.pool.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  });

  app.get('/api/trending', async (req) => {
    const limit = z.coerce.number().min(1).max(50).default(10).parse((req.query as any)?.limit);
    const items = await prisma.pool.findMany({
      where: { trending: true },
      orderBy: { vol7d: 'desc' },
      take: limit,
    });
    return { items };
  });

  app.get('/api/pools/:slug', async (req, reply) => {
    const slug = (req.params as any).slug as string;
    const pool = await prisma.pool.findUnique({
      where: { slug },
      include: {
        activity: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { positions: true } },
      },
    });
    if (!pool) return reply.code(404).send({ error: 'pool not found' });
    return pool;
  });

  // Staker leaderboard for a pool: real signed-in positions merged with a
  // deterministic, TVL-scaled synthetic board (stable per slug). Drives the
  // "Stakers" tab on the pool page.
  app.get('/api/pools/:slug/stakers', async (req, reply) => {
    const slug = (req.params as any).slug as string;
    const limit = z.coerce.number().min(1).max(100).default(25).parse((req.query as any)?.limit);

    const pool = await prisma.pool.findUnique({ where: { slug } });
    if (!pool) return reply.code(404).send({ error: 'pool not found' });

    const positions = await prisma.position.findMany({
      where: { poolId: pool.id, valueUsd: { gt: 0 } },
      include: { user: { select: { address: true } } },
      orderBy: { valueUsd: 'desc' },
      take: 50,
    });
    const real = positions.map((p) => ({
      address: '0x..' + p.user.address.slice(-4),
      valueUsd: p.valueUsd,
      lp: p.lp,
    }));

    const { items, count } = buildStakers({ slug, tvl: pool.tvl, apr: pool.apr, real, limit });
    return { items, count, tvlUsd: Math.round(pool.tvl) };
  });
}
