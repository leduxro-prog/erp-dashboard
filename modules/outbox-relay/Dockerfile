# Multi-stage Dockerfile for Outbox Relay Service
# Stage 1: Builder
FROM node:20-alpine AS builder

LABEL maintainer="CYPHER ERP Team"
LABEL version="1.0.0"
LABEL description="CYPHER ERP Outbox Relay Service - Builder Stage"

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Install dev dependencies for build
RUN npm ci

# Build TypeScript
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS production

LABEL maintainer="CYPHER ERP Team"
LABEL version="1.0.0"
LABEL description="CYPHER ERP Outbox Relay Service - Production Runtime"

WORKDIR /app

# Install dumb-init for proper signal handling and openssl
RUN apk add --no-cache dumb-init openssl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:9090/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 9090 9091

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default command: start in continuous mode
CMD ["node", "dist/index.js", "start"]
