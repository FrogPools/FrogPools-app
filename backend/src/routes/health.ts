import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, service: 'frogpools-backend', ts: Date.now() }));
  app.get('/api/health', async () => ({ ok: true }));
}
