# FrogPools backend — deterministic build for Railway (root directory = backend)
FROM node:22-slim

WORKDIR /app

# OpenSSL is required by Prisma engines
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy everything (schema present) so `npm install` postinstall can run `prisma generate`
COPY . .

# Install deps (runs `prisma generate` via postinstall) and compile TypeScript → dist/
RUN npm install && npm run build

EXPOSE 8080

# At runtime: create/update tables (DATABASE_URL is injected), then start.
# The server auto-seeds demo pools on first boot.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm start"]
