# Release image: install published package from npm (no source build).
# Used by CI/release; version passed as build-arg. For local dev build-from-source, use Dockerfile.dev.
# Multi-arch: build for linux/amd64,linux/arm64 (set by buildx).
#
# Node policy: this production/runtime image tracks Node LTS (see FROM below). Non-LTS Node Current
# is exercised in GitHub Actions only (setup-node in workflows), not a second published image unless
# product explicitly asks for one.
#
# Targets:
#   runtime (default) — npm registry install (Release / publish-container).
#   runtime-ci — same layers after install, but package from .ci/docker/package.tgz (Integration workflow).
FROM node:24-alpine@sha256:21f403ab171f2dc89bad4dd69d7721bfd15f084ccb46cdd225f31f2bc59b5c9a AS base

VOLUME /snapshots

# Refresh all installed Alpine packages (pinned FROM digest can still trail repo security fixes).
RUN apk update && apk upgrade --no-cache

# Pin global npm to a newer release than the default in the base image (bundled deps drift with the CLI).
RUN npm install -g npm@11.17.0

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
