# ====== Stage 1: deps ======
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
# Install prod deps early (native builds will target glibc)
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# ====== Stage 2: development (optional) ======
FROM node:20-bookworm-slim AS development
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git curl postgresql-client && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx prisma generate
EXPOSE 3000
ENV NODE_ENV=development NEXT_TELEMETRY_DISABLED=1
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["npm", "run", "dev"]

# ====== Stage 3: builder ======
FROM node:20-bookworm-slim AS builder
WORKDIR /app
# toolchain for any native rebuilds during build
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential ca-certificates git && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ====== Stage 4: production runner ======
FROM node:20-bookworm-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl postgresql-client && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy the Next standalone output and static assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# (Optional) ensure prisma client present in runner
RUN npx prisma generate

USER nextjs
EXPOSE 3000
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]

