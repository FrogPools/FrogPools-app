import 'dotenv/config';

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: req('DATABASE_URL'),
  JWT_SECRET: req('JWT_SECRET', 'dev-insecure-secret-change-me'),
  SIWE_DOMAIN: req('SIWE_DOMAIN', 'localhost:3000'),
  SIWE_CHAIN_ID: Number(req('SIWE_CHAIN_ID', '1')),
  CORS_ORIGINS: req('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  PORT: Number(process.env.PORT ?? '8080'),
};
