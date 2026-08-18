import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function healthRoutes(app: FastifyInstance) {
  // Instant liveness — no DB touch. Point uptime pings / Railway healthcheck here.
  app.get('/api/health', async () => ({ ok: true }));

  // Readiness — verifies the database is actually reachable.
  app.get('/health', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, service: 'frogpools-backend', db: true, ts: Date.now() };
    } catch (_e) {
      reply.code(503);
      return { ok: false, service: 'frogpools-backend', db: false, ts: Date.now() };
    }
  });
}
