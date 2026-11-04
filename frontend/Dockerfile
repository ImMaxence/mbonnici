# Build context = repository root (the changelog is shipped with the back office).
#   docker build -f frontend/Dockerfile .
# ── build ─────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY CHANGELOG.md /app/CHANGELOG.md
COPY frontend/ ./
RUN npm run build

# ── runtime (SSR server + static assets, no node_modules needed) ──────────────
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=4000 \
    PROXY_API=true
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/frontend/dist/mbonnici ./dist/mbonnici
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/healthz || exit 1
CMD ["node", "dist/mbonnici/server/server.mjs"]
