import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const listQuery = z.object({
  sort: z.enum(['apr', 'tvl', 'vol']).default('apr'),
  filter: z.enum(['all', 'open', 'trending', 'new']).default('all'),
  limit: z.coerce.number().min(1).max(100).default(24),
  page: z.coerce.number().min(1).default(1),
});

const orderBy = { apr: { apr: 'desc' }, tvl: { tvl: 'desc' }, vol: { vol7d: 'desc' } } as const;

export async function poolRoutes(app: FastifyInstance) {
  app.get('/api/pools', async (req) => {
    const q = listQuery.parse(req.query);
    const where =
      q.filter === 'open' ? { stage: 'open' } :
      q.filter === 'trending' ? { trending: true } :
      q.filter === 'new' ? { isNew: true } : {};
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
}
