# kairos MCP Server - no local repo dependency; install from public npm registry
# Multi-arch: linux/amd64, linux/arm64 (Buildx uses node image per platform)
FROM node:25-alpine

# Pin kairos version at build time (default: latest). CI passes e.g. 3.0.0 from tag.
ARG KAIROS_VERSION=latest
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/

WORKDIR /app
RUN npm init -y && npm install kairos@${KAIROS_VERSION} && npm cache clean --force

VOLUME /snapshots

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kairos -u 1001

RUN mkdir -p logs storage/qdrant && \
    chown -R kairos:nodejs /app logs storage

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
# ENV QDRANT_API_KEY=change_me_with_safe_characters

CMD ["node", "node_modules/kairos/dist/index.js"]
