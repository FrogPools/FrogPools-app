import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyMessage } from 'ethers';
import { prisma } from '../lib/prisma.js';

// Early-access / staking-intent capture.
//
// The frontend gate does two real things before this is called:
//   1) reads the wallet's on-chain WETH balance and blocks amounts it can't cover,
//   2) asks the wallet to `personal_sign` a human-readable intent message.
// Here we VERIFY that signature really came from the authenticated wallet (so the
// record is trustworthy), then store it. No funds are ever moved or approved.
const bodySchema = z.object({
  poolSlug: z.string().max(80).default(''),
  pair: z.string().max(80).default(''),
  amountUsd: z.number().nonnegative().max(1_000_000_000).default(0),
  amountWeth: z.number().nonnegative().default(0),
  wethBal: z.number().nonnegative().default(0),
  message: z.string().min(8).max(4000),
  signature: z.string().min(8).max(400),
});

export async function earlyRoutes(app: FastifyInstance) {
  const auth = { preHandler: app.authenticate };

  app.post('/api/early-access', auth, async (req, reply) => {
    const { address } = req.user;
    const b = bodySchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid payload' });

    // Recover the signer from the signature and confirm it matches the session wallet.
    let recovered = '';
    try {
      recovered = verifyMessage(b.data.message, b.data.signature).toLowerCase();
    } catch {
      return reply.code(400).send({ error: 'bad signature' });
    }
    if (recovered !== address.toLowerCase()) {
      return reply.code(401).send({ error: 'signature does not match wallet' });
    }

    const entry = await prisma.earlyAccess.create({
      data: {
        address: address.toLowerCase(),
        poolSlug: b.data.poolSlug,
        pair: b.data.pair,
        amountUsd: b.data.amountUsd,
        amountWeth: b.data.amountWeth,
        wethBal: b.data.wethBal,
        signature: b.data.signature,
        message: b.data.message,
      },
    });

    // Vanity "you're #N on the list" - distinct wallets that have signed up.
    const grouped = await prisma.earlyAccess.findMany({ select: { address: true }, distinct: ['address'] });
    return { ok: true, id: entry.id, position: grouped.length };
  });

  // Lightweight lead export for the project owner. Guarded by a secret header so it
  // is not public; set EARLY_ACCESS_KEY in the backend env and pass it as x-admin-key.
  app.get('/api/early-access/list', async (req, reply) => {
    const key = process.env.EARLY_ACCESS_KEY;
    if (!key || (req.headers['x-admin-key'] as string) !== key) {
      return reply.code(404).send({ error: 'not found' });
    }
    const items = await prisma.earlyAccess.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    return { count: items.length, items };
  });
}
