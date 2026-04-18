# 构建并打包全部后端微服务（workspace + turbo）；运行时由 compose 指定具体服务目录执行 bootstrap.js
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps

RUN pnpm install --frozen-lockfile
RUN pnpm run build:service

ENV NODE_ENV=production
# 由 docker-compose 覆盖
CMD ["sh", "-c", "echo 'Override CMD with service bootstrap'; exit 1"]
