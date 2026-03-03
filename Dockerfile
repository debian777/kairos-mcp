# Install kairos from npm registry
# Multi-arch support for x64 and ARM64
FROM node:25-alpine AS production

# KAIROS_VERSION must be an explicit semver in CI (passed via --build-arg from publish-docker.yml).
# 'latest' is only a fallback for local ad-hoc builds.
ARG KAIROS_VERSION=latest

VOLUME /snapshots

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001

# Set working directory
WORKDIR /app

# Install the published npm package (pre-built dist, no TypeScript compilation needed)
RUN npm install @debian777/kairos@${KAIROS_VERSION} --omit=dev && npm cache clean --force

# Create directories for logs and data
RUN mkdir -p logs storage/qdrant && \
    chown -R kairos:nodejs logs storage

# Switch to non-root user
USER kairos

# Port configuration (configurable via build arg)
ARG PORT=3500
ENV PORT=${PORT}

# Metrics port configuration
ARG METRICS_PORT=9090
ENV METRICS_PORT=${METRICS_PORT}

# Expose ports for HTTP/WebSocket transports and metrics
EXPOSE ${PORT} ${METRICS_PORT}

# Health check (Node.js based, no curl/wget needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Environment variables (defaults commented out where safe)
ENV NODE_ENV=production
ENV QDRANT_URL=http://qdrant:6333
ENV QDRANT_COLLECTION=kairos_memories
# ENV QDRANT_API_KEY=change_me_with_safe_characters

# Start the MCP server
CMD ["node", "node_modules/@debian777/kairos/dist/index.js"]