# Multi-stage Dockerfile for Next.js application

# Base stage with dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Install system dependencies required for onnxruntime-node
RUN apk add --no-cache \
    gcompat \
    libstdc++ \
    && ln -s /lib/libc.musl-aarch64.so.1 /lib/ld-linux-aarch64.so.1 || true \
    && ln -s /lib/libc.musl-x86_64.so.1 /lib64/ld-linux-x86-64.so.2 || true

# Install dependencies only when needed
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Development stage
FROM base AS development
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Set environment to development
ENV NODE_ENV=development

# Start Next.js in development mode with hot reload
CMD ["npm", "run", "dev"]

# Builder stage for production
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build application
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Start Next.js in production mode
CMD ["node", "server.js"]
