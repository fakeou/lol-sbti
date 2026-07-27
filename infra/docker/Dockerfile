# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY skills ./skills
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lol-sbti/contracts build \
 && pnpm --filter @lol-sbti/domain build \
 && pnpm --filter @lol-sbti/analysis-skill build \
 && pnpm --filter @lol-sbti/persistence build \
 && pnpm --filter @lol-sbti/api build \
 && pnpm --filter @lol-sbti/worker build \
 && pnpm --filter @lol-sbti/web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && useradd --system --uid 10001 lolsbti
COPY --from=build --chown=lolsbti:lolsbti /app /app
USER lolsbti
