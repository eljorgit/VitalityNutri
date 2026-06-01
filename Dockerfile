# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install native build tools required by better-sqlite3
RUN apk add --no-cache python3 make g++

# Install ALL dependencies (dev + prod) so native modules compile correctly
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build: Vite frontend + bundle server with esbuild
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy pre-compiled node_modules from builder (avoids recompiling native modules)
COPY --from=builder /app/node_modules ./node_modules

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Copy prompt file used at runtime by the server
COPY promt.md ./promt.md

# Create data directories for SQLite DB and uploaded PDFs
RUN mkdir -p data/uploads

# Expose the port used by Express
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Run the pre-bundled server
CMD ["node", "dist/server.cjs"]
