# Multi-stage Dockerfile for CYPHER ERP
# Stage 1: Builder
FROM node:20-alpine AS builder

LABEL maintainer="CYPHER ERP Team"
LABEL version="0.1.0"
LABEL description="CYPHER ERP/CRM System - Builder Stage"

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY src ./src
COPY shared ./shared
COPY modules ./modules
COPY database ./database

# Build TypeScript
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS production

LABEL maintainer="CYPHER ERP Team"
LABEL version="0.1.0"
LABEL description="CYPHER ERP/CRM System - Production Runtime"

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create config directory for settings with proper permissions
RUN mkdir -p /app/config && chown nodejs:nodejs /app/config

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start application
CMD ["node", "dist/src/server.js"]
