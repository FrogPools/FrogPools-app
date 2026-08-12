import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const q = z.object({
  pool: z.string().optional(), // pool slug
  kind: z.enum(['all', 'stakes', 'router', 'claims']).default('all'),
  limit: z.coerce.number().min(1).max(100).default(30),
});

export async function activityRoutes(app: FastifyInstance) {
  app.get('/api/activity', async (req) => {
    const p = q.parse(req.query);
    const verbFilter =
      p.kind === 'stakes' ? { verb: { in: ['staked', 'unstaked'] } } :
      p.kind === 'router' ? { verb: 'compounded' } :
      p.kind === 'claims' ? { verb: 'claimed' } : {};
    const poolFilter = p.pool ? { pool: { slug: p.pool } } : {};
    const items = await prisma.activity.findMany({
      where: { ...verbFilter, ...poolFilter },
      orderBy: { createdAt: 'desc' },
      take: p.limit,
      include: { pool: { select: { pair: true, emoji: true, slug: true, icon: true } } },
    });
    return { items };
  });
}
