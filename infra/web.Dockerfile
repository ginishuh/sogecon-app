# syntax=docker/dockerfile:1

FROM node:22.17.1-slim AS build

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/schemas/package.json packages/schemas/package.json

RUN pnpm -C apps/web install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages/schemas ./packages/schemas

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
    && pnpm -C apps/web prune --prod \
    && rm -rf /app/apps/web/.next/cache

FROM node:22.17.1-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable \
    && adduser --disabled-password --gecos "" webuser

WORKDIR /app

COPY --from=build /app/apps/web /app/apps/web
COPY --from=build /app/packages /app/packages
COPY --from=build /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

WORKDIR /app/apps/web

USER webuser

EXPOSE 3000

CMD ["pnpm", "start"]
