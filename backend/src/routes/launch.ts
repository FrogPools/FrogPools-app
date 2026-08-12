import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const slugify = (s: string) =>
  s.toLowerCase().replace(/\$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

export async function launchRoutes(app: FastifyInstance) {
  app.post('/api/launch', { preHandler: app.authenticate }, async (req, reply) => {
    const { sub } = req.user;
    const body = z
      .object({
        token: z.string().min(1).max(24),
        pairedWith: z.string().default('WETH'),
        feeTier: z.number().default(0.3),
        target: z.number().positive().max(10_000_000).default(100_000),
        emoji: z.string().default('🐸'),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'token required' });

    const token = body.data.token.startsWith('$') ? body.data.token : `$${body.data.token}`;
    const pair = `${token} / ${body.data.pairedWith}`;
    const slug = slugify(pair);

    const exists = await prisma.pool.findUnique({ where: { slug } });
    if (exists) return reply.code(409).send({ error: 'pool already exists', slug });

    const pool = await prisma.pool.create({
      data: {
        slug, token, pair, emoji: body.data.emoji,
        feeTier: body.data.feeTier, target: body.data.target,
        apr: 0, tvl: 0, stage: 'open', isNew: true, creatorId: sub,
      },
    });
    return { ok: true, pool };
  });
}
