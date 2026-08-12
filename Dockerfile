# FrogPools monorepo — builds the backend (./backend) for Railway.
# With this Dockerfile at the repo ROOT, Railway needs NO "Root Directory" setting.
FROM node:22-slim

WORKDIR /app

# OpenSSL required by Prisma engines
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy the backend source (schema present so postinstall `prisma generate` works)
COPY backend/ ./

# Install deps (runs prisma generate via postinstall) and compile TS -> dist/
RUN npm install && npm run build

EXPOSE 8080

# At runtime: create/update tables (DATABASE_URL injected), then start (auto-seeds on first boot)
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm start"]
