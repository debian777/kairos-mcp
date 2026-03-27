# Release image: install published package from npm (no source build).
# Used by CI/release; version passed as build-arg. For local dev build-from-source, use Dockerfile.dev.
# Multi-arch: build for linux/amd64,linux/arm64 (set by buildx).
#
# Targets:
#   runtime (default) — npm registry install (Release / publish-container).
#   runtime-ci — same layers after install, but package from .ci/docker/package.tgz (Integration workflow).
FROM node:25-alpine@sha256:cf38e1f3c28ac9d81cdc0c51d8220320b3b618780e44ef96a39f76f7dbfef023 AS base

VOLUME /snapshots

# Refresh zlib from Alpine repos (FROM digest can still trail apk security fixes).
RUN apk update && apk upgrade --no-cache zlib

# Pin global npm to a newer release than the default in the base image (bundled deps drift with the CLI).
RUN npm install -g npm@11.12.0

ARG PACKAGE_VERSION
RUN test -n "$PACKAGE_VERSION" || (echo "Build-arg PACKAGE_VERSION is required" && exit 1)

RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001

WORKDIR /app

FROM base AS deps-registry
ARG PACKAGE_VERSION
RUN printf '%s\n' "{\"private\":true,\"dependencies\":{\"@debian777/kairos-mcp\":\"${PACKAGE_VERSION}\"},\"overrides\":{\"minimatch\":\"^10.2.3\",\"tar\":\"^7.5.11\"}}" > package.json && \
    npm install --omit=dev && \
    npm cache clean --force && \
    chown -R kairos:nodejs /app

FROM base AS deps-local
COPY .ci/docker/package.tgz /tmp/pkg.tgz
RUN printf '%s\n' "{\"private\":true,\"dependencies\":{\"@debian777/kairos-mcp\":\"file:/tmp/pkg.tgz\"},\"overrides\":{\"minimatch\":\"^10.2.3\",\"tar\":\"^7.5.11\"}}" > package.json && \
    npm install --omit=dev && \
    npm cache clean --force && \
    chown -R kairos:nodejs /app

# Keep runtime-ci and runtime final layers in sync (duplicate on purpose; Docker has no shared snippet).
FROM deps-local AS runtime-ci
RUN mkdir -p logs storage/qdrant /snapshots && \
    chown -R kairos:nodejs /app logs storage /snapshots
USER kairos
ARG PORT=3000
ENV PORT=${PORT}
ARG METRICS_PORT=9090
ENV METRICS_PORT=${METRICS_PORT}
EXPOSE ${PORT} ${METRICS_PORT}
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1
ENV NODE_ENV=production
ENV QDRANT_URL=http://qdrant:6333
ENV QDRANT_COLLECTION=kairos_memories
CMD ["node", "node_modules/@debian777/kairos-mcp/dist/index.js"]

FROM deps-registry AS runtime
RUN mkdir -p logs storage/qdrant /snapshots && \
    chown -R kairos:nodejs /app logs storage /snapshots
USER kairos
ARG PORT=3000
ENV PORT=${PORT}
ARG METRICS_PORT=9090
ENV METRICS_PORT=${METRICS_PORT}
EXPOSE ${PORT} ${METRICS_PORT}
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + process.env.PORT + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1
ENV NODE_ENV=production
ENV QDRANT_URL=http://qdrant:6333
ENV QDRANT_COLLECTION=kairos_memories
CMD ["node", "node_modules/@debian777/kairos-mcp/dist/index.js"]
