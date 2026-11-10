# ========================================================
# Dockerfile for Anti-Gallery (آرت‌گشت)
# Optimized for offline operation during international internet cuts.
# MUST BE BUILT ON LAPTOP WITH INTERNET, THEN EXPORTED VIA:
#   docker save artgasht:latest | gzip > artgasht.tar.gz
# ========================================================

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build Vite static files
COPY . .
RUN npm run build

# Stage 2: Production Self-Contained Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Install production dependencies only (includes express & tsx)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy seed data baselines
COPY --from=builder /app/src/data ./src/data

# Copy backend server script
COPY --from=builder /app/server.ts ./server.ts

# Create persistent data and uploads directory
RUN mkdir -p /app/data/uploads

# Expose internal HTTP port
EXPOSE 3000

# Container health check against /health endpoint
HEALTHCHECK --interval=20s --timeout=4s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

# Start full-stack server
CMD ["npx", "tsx", "server.ts"]
