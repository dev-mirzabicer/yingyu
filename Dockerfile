# --- deps: install node_modules (prod deps) ---
FROM node:20-bullseye AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Optional: faster installs in CN; harmless elsewhere
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY}

COPY package*.json ./
# Install ALL deps (including dev) for the build step; we'll prune later
RUN npm ci --legacy-peer-deps

# --- builder: build Next standalone & Prisma client ---
FROM node:20-bullseye AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client BEFORE build so it's bundled correctly
# (Assumes prisma CLI is in dependencies or devDependencies)
RUN npx prisma generate

# Build Next.js (must produce .next/standalone)
RUN npm run build

# Optional: prune dev deps to shrink handover to runner (not strictly needed with standalone)
RUN npm prune --omit=dev

# --- runner: production container ---
FROM node:20-bullseye AS production
WORKDIR /app

# Create non-root user
RUN useradd -m -u 1001 nextjs

# Copy standalone server + static assets + public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Useful tools for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Make sure files are owned by the non-root user
RUN chown -R nextjs:nextjs /app
USER nextjs

EXPOSE 3000

# Healthcheck: your app should expose /api/health
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]

