import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { newNonce, verifySiwe } from '../lib/auth.js';
import { env } from '../env.js';

const addr = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export async function authRoutes(app: FastifyInstance) {
  // 1) Client asks for a nonce for its address; we store it on the user.
  app.get('/api/auth/nonce', async (req, reply) => {
    const parsed = addr.safeParse((req.query as any)?.address);
    if (!parsed.success) return reply.code(400).send({ error: 'valid ?address required' });
    const address = parsed.data.toLowerCase();
    const nonce = newNonce();
    await prisma.user.upsert({
      where: { address },
      update: { nonce },
      create: { address, nonce },
    });
    return { nonce, domain: env.SIWE_DOMAIN, chainId: env.SIWE_CHAIN_ID };
  });

  // 2) Client signs the SIWE message and posts it back; we verify + issue a JWT.
  app.post('/api/auth/verify', async (req, reply) => {
    const body = z.object({ message: z.string(), signature: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'message + signature required' });

    // Peek the address from the message to load its stored nonce.
    const m = body.data.message;
    const addrMatch = m.match(/0x[a-fA-F0-9]{40}/);
    if (!addrMatch) return reply.code(400).send({ error: 'no address in message' });
    const address = addrMatch[0].toLowerCase();

    const user = await prisma.user.findUnique({ where: { address } });
    if (!user?.nonce) return reply.code(401).send({ error: 'no active nonce — request one first' });

    const result = await verifySiwe(m, body.data.signature, user.nonce);
    if (!result.ok || result.address !== address) {
      return reply.code(401).send({ error: result.error ?? 'verification failed' });
    }

    // consume the nonce
    await prisma.user.update({ where: { address }, data: { nonce: null } });

    const token = app.jwt.sign({ sub: user.id, address }, { expiresIn: '7d' });
    return { token, address };
  });
}
