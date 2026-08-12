import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from '../env.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; address: string };
    user: { sub: string; address: string };
  }
}

// Registers JWT and exposes app.authenticate as a preHandler guard.
export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });
}
