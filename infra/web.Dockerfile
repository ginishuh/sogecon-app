# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.17.1
FROM node:${NODE_VERSION}-slim AS build

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true

# 앱 엔진 범위를 만족하는 pnpm 버전을 사용해 엔진 불일치를 방지
ARG PNPM_VERSION=latest-10
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Minimal files for deterministic install in workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/schemas/package.json packages/schemas/package.json

# Install only web workspace deps (respects the lockfile)
RUN pnpm -C apps/web install --frozen-lockfile

# Add sources after install to leverage Docker layer caching
COPY apps/web ./apps/web
COPY packages/schemas ./packages/schemas

# Build-time public envs
ARG NEXT_PUBLIC_WEB_API_BASE=""
ARG NEXT_PUBLIC_SITE_URL=""
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ARG NEXT_PUBLIC_ANALYTICS_ID=""
ARG NEXT_PUBLIC_ENABLE_SW=""
ARG NEXT_PUBLIC_RELAX_CSP=""
ARG NEXT_PUBLIC_IMAGE_DOMAINS=""

ENV NEXT_PUBLIC_WEB_API_BASE=${NEXT_PUBLIC_WEB_API_BASE} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY} \
    NEXT_PUBLIC_ANALYTICS_ID=${NEXT_PUBLIC_ANALYTICS_ID} \
    NEXT_PUBLIC_ENABLE_SW=${NEXT_PUBLIC_ENABLE_SW} \
    NEXT_PUBLIC_RELAX_CSP=${NEXT_PUBLIC_RELAX_CSP} \
    NEXT_PUBLIC_IMAGE_DOMAINS=${NEXT_PUBLIC_IMAGE_DOMAINS}

RUN pnpm -C apps/web build \
    && pnpm --filter web deploy --prod --legacy /opt/app_web

FROM node:${NODE_VERSION}-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=true

RUN adduser --disabled-password --gecos "" webuser

WORKDIR /app/apps/web

# Copy self-contained deployment that includes node_modules
COPY --from=build /opt/app_web /app/apps/web

USER webuser

EXPOSE 3000

# Avoid requiring pnpm in runtime; call Next directly
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
