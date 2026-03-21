# Release image: install published package from npm (no source build).
# Used by CI/release; version passed as build-arg. For local dev build-from-source, use Dockerfile.dev.
# Multi-arch: build for linux/amd64,linux/arm64 (set by buildx).
FROM node:25-alpine

VOLUME /snapshots

# CVE-2026-22184 (zlib): patch Alpine package only; keep base image otherwise unchanged.
RUN apk update && apk upgrade --no-cache zlib

# Node image ships npm with vendored minimatch/tar; Trivy flags HIGH on those until npm bumps them.
# Pin npm so global CLI matches a release that bundles patched transitive versions.
RUN npm install -g npm@11.12.0

# Pin version at build time (required; set by release workflow).
ARG PACKAGE_VERSION
RUN test -n "$PACKAGE_VERSION" || (echo "Build-arg PACKAGE_VERSION is required" && exit 1)

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001

WORKDIR /app

# Install from registry. Root overrides apply here; overrides inside the published package.json do not
# affect this install tree (npm only honors overrides at the project root). Keeps tar/minimatch on patched
# releases for Trivy (CRITICAL/HIGH) in release.yml.
RUN printf '%s\n' "{\"private\":true,\"dependencies\":{\"@debian777/kairos-mcp\":\"${PACKAGE_VERSION}\"},\"overrides\":{\"minimatch\":\"^10.2.3\",\"tar\":\"^7.5.11\"}}" > package.json && \
    npm install --omit=dev && \
    npm cache clean --force && \
    chown -R kairos:nodejs /app

# Create directories for logs, data, and snapshots (VOLUME mount point; kairos must be able to write)
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

# Run the installed package's main entry (dist/index.js is inside node_modules)
CMD ["node", "node_modules/@debian777/kairos-mcp/dist/index.js"]
