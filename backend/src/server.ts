import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { ensureSeed, ensureIcons } from './lib/bootstrap.js';
import { startSimulator } from './lib/simulator.js';
import { registerAuth } from './plugins/authenticate.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { poolRoutes } from './routes/pools.js';
import { activityRoutes } from './routes/activity.js';
import { meRoutes } from './routes/me.js';
import { launchRoutes } from './routes/launch.js';
import { statsRoutes } from './routes/stats.js';
import { earlyRoutes } from './routes/early.js';

async function main() {
  // trustProxy: Railway terminates TLS at a proxy, so req.ip / rate-limit must
  // read the forwarded client IP rather than the proxy's.
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(cors, {
    origin: (origin, cb) => {
      // allow same-origin / curl (no origin) and any explicitly allowed origin
      if (!origin || env.CORS_ORIGINS.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await registerAuth(app);

  // Consistent JSON errors. Validation → 400; everything else → its status or 500,
  // with internals hidden in production.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const status = (err as any).statusCode && (err as any).statusCode >= 400 ? (err as any).statusCode : 500;
    if (status >= 500) req.log.error({ err }, 'unhandled error');
    return reply.code(status).send({ error: status >= 500 ? 'internal error' : err.message || 'error' });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'not found', path: req.url });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(poolRoutes);
  await app.register(activityRoutes);
  await app.register(meRoutes);
  await app.register(launchRoutes);
  await app.register(statsRoutes);
  await app.register(earlyRoutes);

  // Verify DB connectivity up front so a bad DATABASE_URL fails loudly at boot
  // (instead of every request 500-ing later with a cryptic message).
  try {
    await prisma.$connect();
    app.log.info('database connected');
  } catch (e) {
    app.log.error({ err: e }, 'database connection failed — check DATABASE_URL');
    throw e;
  }

  // Seed demo pools on first boot if the DB is empty (safe to call every start).
  try {
    await ensureSeed();
    await ensureIcons();
  } catch (e) {
    app.log.warn({ err: e }, 'ensureSeed skipped');
  }

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  // demo activity simulator — keeps the feed & numbers moving on their own
  startSimulator();

  // Graceful shutdown so Railway redeploys / scale events don't drop in-flight
  // requests or leak DB connections.
  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');
    try { await app.close(); } catch (_) { /* ignore */ }
    try { await prisma.$disconnect(); } catch (_) { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
