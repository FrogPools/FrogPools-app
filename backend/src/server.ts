import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.js';
import { ensureSeed } from './lib/bootstrap.js';
import { registerAuth } from './plugins/authenticate.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { poolRoutes } from './routes/pools.js';
import { activityRoutes } from './routes/activity.js';
import { meRoutes } from './routes/me.js';
import { launchRoutes } from './routes/launch.js';

async function main() {
  const app = Fastify({ logger: true });

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

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(poolRoutes);
  await app.register(activityRoutes);
  await app.register(meRoutes);
  await app.register(launchRoutes);

  // seed demo pools on first boot if the DB is empty (safe to call every start)
  try {
    await ensureSeed();
  } catch (e) {
    app.log.warn({ err: e }, 'ensureSeed skipped');
  }

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
