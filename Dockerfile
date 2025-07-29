# Dockerfile for YingYu English Teaching App
# Multi-stage build for optimal production deployment
# 
# NOTE: This Dockerfile is currently NOT used by docker-compose.yml for development.
# The docker-compose.yml uses node:20-alpine directly to avoid Docker Buildx issues on macOS/Colima.
# This Dockerfile is kept for:
# 1. Production deployments (use: docker build --target production .)
# 2. Alternative development setup (use: docker build --target development .)
# 3. CI/CD pipelines that support multi-stage builds

# ================================================================
# Stage 1: Dependencies
# ================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies with npm ci for reproducible builds (with legacy peer deps for React 19 compatibility)
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# ================================================================
# Stage 2: Development Setup
# ================================================================
FROM node:20-alpine AS development

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    postgresql-client \
    curl

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "dev"]

# ================================================================
# Stage 3: Builder (for production builds)
# ================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# ================================================================
# Stage 4: Production Runner
# ================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    postgresql-client

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Copy built Next.js application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Generate Prisma client in production
RUN npx prisma generate

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]