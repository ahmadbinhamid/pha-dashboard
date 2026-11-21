# syntax=docker/dockerfile:1
# NOTE: Node 22 matches the production host (v22.23.1), dev and CI.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
# Cache mount keeps the npm download cache between builds.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --prefer-offline --no-audit --no-fund
COPY . .
EXPOSE 7000
CMD ["node", "src/server.js"]
