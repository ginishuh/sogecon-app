# syntax=docker/dockerfile:1

FROM python:3.12-slim AS build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq5 libpq-dev libjpeg62-turbo-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY apps/api/requirements.txt ./requirements.txt

RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/* \
    && adduser --disabled-password --gecos "" apiuser

WORKDIR /app

COPY --from=build /install /usr/local
COPY apps/api ./apps/api
COPY ops/ci/migration_gate.py ./ops/ci/migration_gate.py
COPY infra/api-entrypoint.sh /app/infra/api-entrypoint.sh

RUN mkdir -p uploads \
    && chmod +x /app/infra/api-entrypoint.sh \
    && chown apiuser:apiuser uploads

USER apiuser

EXPOSE 3001

ENTRYPOINT ["/app/infra/api-entrypoint.sh"]
