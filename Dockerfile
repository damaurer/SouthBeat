# SouthBeat as one container: the Angular SSR server with the game API and the online server.
#
#   docker build -t southbeat .
#   docker run -p 4000:4000 -v southbeat-data:/app/data southbeat

# Another registry can be used with --build-arg NODE_IMAGE=..., e.g. when Docker Hub limits pulls.
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    SOUTHBEAT_DATA_FILE=/app/data/southbeat.json
# The server bundle contains everything it needs, so no node_modules are copied.
COPY --from=build /src/dist/southbeat ./dist/southbeat
# Fighters, statistics and ladder progress live here; mount a volume to keep them.
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME /app/data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT}/api/stats > /dev/null || exit 1
CMD ["node", "dist/southbeat/server/server.mjs"]
