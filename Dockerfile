# Multi-stage build for kairos MCP Server
# Multi-arch support for x64 and ARM64
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY eslint.config.cjs ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code and build scripts
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY docs/ ./docs/

# Build the application (includes embedding MCP resources)
RUN npm run build

# Production stage - Multi-arch support
FROM node:24-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=kairos:nodejs /app/dist ./dist
COPY --from=builder --chown=kairos:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=kairos:nodejs /app/package.json ./

# Create directories for logs and data
RUN mkdir -p logs storage/qdrant && \
    chown -R kairos:nodejs logs storage

# Switch to non-root user
USER kairos

# Port configuration (configurable via build arg)
ARG PORT=3500
ENV PORT=${PORT}

# Expose port for HTTP/WebSocket transports
EXPOSE ${PORT}

# Health check (Node.js based, no curl/wget needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Environment variables (defaults commented out where safe)
ENV NODE_ENV=production
ENV QDRANT_URL=http://qdrant:6333
ENV QDRANT_COLLECTION=kairos_memories
# ENV QDRANT_API_KEY=change_me_with_safe_characters

# Start the MCP server with HTTP/WebSocket support
CMD ["node", "dist/index.js"]