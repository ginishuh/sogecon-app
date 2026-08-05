# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.12.0
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
ARG WEB_BUILD_ALLOW_INSECURE_LOCAL_API=""

ENV NEXT_PUBLIC_WEB_API_BASE=${NEXT_PUBLIC_WEB_API_BASE} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY} \
    NEXT_PUBLIC_ANALYTICS_ID=${NEXT_PUBLIC_ANALYTICS_ID} \
    NEXT_PUBLIC_ENABLE_SW=${NEXT_PUBLIC_ENABLE_SW} \
    NEXT_PUBLIC_RELAX_CSP=${NEXT_PUBLIC_RELAX_CSP} \
    NEXT_PUBLIC_IMAGE_DOMAINS=${NEXT_PUBLIC_IMAGE_DOMAINS} \
    WEB_BUILD_ALLOW_INSECURE_LOCAL_API=${WEB_BUILD_ALLOW_INSECURE_LOCAL_API}

# Next's standalone output already contains the production dependency closure
# and embeds the build-time Next configuration. Preserve that exact artifact
# instead of starting a separate `next start` server that re-reads runtime
# configuration.
RUN pnpm -C apps/web build \
    && mkdir -p /opt/app_web/apps/web/.next \
    && cp -a apps/web/.next/standalone/. /opt/app_web/ \
    && cp -a apps/web/.next/static /opt/app_web/apps/web/.next/static \
    && if [ -d apps/web/public ]; then cp -a apps/web/public /opt/app_web/apps/web/public; fi \
    && chmod -R a+rX /opt/app_web

FROM node:${NODE_VERSION}-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN adduser --disabled-password --gecos "" webuser

WORKDIR /app

# Keep the generated standalone directory layout. Its server lives at
# /app/apps/web/server.js and resolves public/static assets relative to it.
COPY --from=build --chown=webuser:webuser /opt/app_web /app

USER webuser

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=9 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

# Run the generated standalone entrypoint so build-time public configuration
# remains authoritative at runtime.
CMD ["node", "apps/web/server.js"]
