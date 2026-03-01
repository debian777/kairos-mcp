# Run from a context that already has dist/ built (e.g. npm run build on host or in CI).
# Build locally: npm run build && docker build -t kairos-mcp .
# Multi-arch: use buildx; context must include package*.json and dist/.
FROM node:25-alpine

WORKDIR /app

# Copy package manifests and pre-built output (no source build in image)
COPY package*.json ./
COPY dist ./dist

# Production dependencies only; dist/ is already built
RUN npm ci --omit=dev && npm cache clean --force

# Create app user and dirs
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001 && \
    mkdir -p logs storage/qdrant && \
    chown -R kairos:nodejs /app

VOLUME /snapshots

USER kairos

# Port configuration (configurable via build arg)
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

CMD ["node", "dist/index.js"]
