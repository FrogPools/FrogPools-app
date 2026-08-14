import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, accrue, WETH_USD } from '../lib/prisma.js';

const LP_PRICE = 500; // demo: 1 LP unit ≈ $500
const short = (a: string) => `0x..${a.slice(-4)}`;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export async function meRoutes(app: FastifyInstance) {
  const auth = { preHandler: app.authenticate };

  app.get('/api/me', auth, async (req) => {
    const { sub, address } = req.user;
    const positions = await prisma.position.count({ where: { userId: sub } });
    return { address, positions };
  });

  // Positions with fees accrued up to now (lazily persisted).
  app.get('/api/me/positions', auth, async (req) => {
    const { sub } = req.user;
    const positions = await prisma.position.findMany({ where: { userId: sub }, include: { pool: true } });
    const now = new Date();
    const out = [];
    for (const p of positions) {
      const feesWeth = accrue(p, p.pool.apr, now);
      if (feesWeth !== p.feesWeth) {
        await prisma.position.update({ where: { id: p.id }, data: { feesWeth, updatedAt: now } });
      }
      out.push({
        pool: { slug: p.pool.slug, pair: p.pool.pair, emoji: p.pool.emoji, apr: p.pool.apr, icon: p.pool.icon },
        lp: p.lp, valueUsd: p.valueUsd, feesWeth: Number(feesWeth.toFixed(6)),
        feesUsd: Number((feesWeth * WETH_USD).toFixed(2)),
      });
    }
    return { positions: out };
  });

  app.post('/api/pools/:slug/stake', auth, async (req, reply) => {
    const { sub, address } = req.user;
    const slug = (req.params as any).slug as string;
    const body = z.object({ valueUsd: z.number().positive().max(1_000_000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'valueUsd (number) required' });

    const pool = await prisma.pool.findUnique({ where: { slug } });
    if (!pool) return reply.code(404).send({ error: 'pool not found' });

    const lp = body.data.valueUsd / LP_PRICE;
    const now = new Date();
    const existing = await prisma.position.findUnique({ where: { userId_poolId: { userId: sub, poolId: pool.id } } });
    const feesWeth = existing ? accrue(existing, pool.apr, now) : 0;

    const position = await prisma.position.upsert({
      where: { userId_poolId: { userId: sub, poolId: pool.id } },
      update: { lp: { increment: lp }, valueUsd: { increment: body.data.valueUsd }, feesWeth, updatedAt: now },
      create: { userId: sub, poolId: pool.id, lp, valueUsd: body.data.valueUsd, updatedAt: now },
    });
    await prisma.pool.update({ where: { id: pool.id }, data: { tvl: { increment: body.data.valueUsd } } });
    await prisma.activity.create({
      data: { poolId: pool.id, address: short(address), verb: 'staked', amount: `${lp.toFixed(2)} LP`, valueUsd: usd(body.data.valueUsd), trigger: 'wallet' },
    });
    return { ok: true, position };
  });

  app.post('/api/pools/:slug/unstake', auth, async (req, reply) => {
    const { sub, address } = req.user;
    const slug = (req.params as any).slug as string;
    const body = z.object({ valueUsd: z.number().positive() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'valueUsd (number) required' });

    const pool = await prisma.pool.findUnique({ where: { slug } });
    if (!pool) return reply.code(404).send({ error: 'pool not found' });
    const pos = await prisma.position.findUnique({ where: { userId_poolId: { userId: sub, poolId: pool.id } } });
    if (!pos || pos.valueUsd <= 0) return reply.code(400).send({ error: 'no active position' });

    const take = Math.min(body.data.valueUsd, pos.valueUsd);
    const lpOut = take / LP_PRICE;
    await prisma.position.update({
      where: { id: pos.id },
      data: { lp: { decrement: Math.min(lpOut, pos.lp) }, valueUsd: { decrement: take }, updatedAt: new Date() },
    });
    await prisma.pool.update({ where: { id: pool.id }, data: { tvl: { decrement: take } } });
    await prisma.activity.create({
      data: { poolId: pool.id, address: short(address), verb: 'unstaked', amount: `${lpOut.toFixed(2)} LP`, valueUsd: usd(take), trigger: 'wallet' },
    });
    return { ok: true };
  });

  app.post('/api/pools/:slug/claim', auth, async (req, reply) => {
    const { sub, address } = req.user;
    const slug = (req.params as any).slug as string;
    const pool = await prisma.pool.findUnique({ where: { slug } });
    if (!pool) return reply.code(404).send({ error: 'pool not found' });
    const pos = await prisma.position.findUnique({ where: { userId_poolId: { userId: sub, poolId: pool.id } } });
    if (!pos) return reply.code(400).send({ error: 'no position' });

    const now = new Date();
    const feesWeth = accrue(pos, pool.apr, now);
    if (feesWeth <= 0) return reply.code(400).send({ error: 'nothing to claim' });
    await prisma.position.update({ where: { id: pos.id }, data: { feesWeth: 0, updatedAt: now } });
    await prisma.activity.create({
      data: { poolId: pool.id, address: short(address), verb: 'claimed', amount: `${feesWeth.toFixed(4)} WETH`, valueUsd: usd(feesWeth * WETH_USD), trigger: 'wallet' },
    });
    return { ok: true, claimedWeth: Number(feesWeth.toFixed(6)) };
  });
}
