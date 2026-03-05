# Release image: install published package from npm (no source build).
# Used by CI/release; version passed as build-arg. For local dev build-from-source, use Dockerfile.dev.
# Multi-arch: build for linux/amd64,linux/arm64 (set by buildx).
FROM node:25-alpine

VOLUME /snapshots

# Pin version at build time (required; set by release workflow).
ARG PACKAGE_VERSION
RUN test -n "$PACKAGE_VERSION" || (echo "Build-arg PACKAGE_VERSION is required" && exit 1)

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001

WORKDIR /app

# Install the published package (and its deps) from registry
RUN npm install @debian777/kairos-mcp@${PACKAGE_VERSION} && \
    npm cache clean --force && \
    chown -R kairos:nodejs /app

# Create directories for logs and data
RUN mkdir -p logs storage/qdrant && \
    chown -R kairos:nodejs logs storage

USER kairos

ARG PORT=3500
ENV PORT=${PORT}
ARG METRICS_PORT=9090
ENV METRICS_PORT=${METRICS_PORT}

EXPOSE ${PORT} ${METRICS_PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

ENV NODE_ENV=production
ENV QDRANT_URL=http://qdrant:6333
ENV QDRANT_COLLECTION=kairos_memories

# Run the installed package's main entry (dist/index.js is inside node_modules)
CMD ["node", "node_modules/@debian777/kairos-mcp/dist/index.js"]
