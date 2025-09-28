.PHONY: venv db-up db-down api-dev web-dev schema-gen

venv:
	python -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip

db-up:
	docker compose -f infra/docker-compose.dev.yml up -d

db-down:
	docker compose -f infra/docker-compose.dev.yml down

api-dev:
	uvicorn apps.api.main:app --reload --port 3001

web-dev:
	pnpm -C apps/web dev

schema-gen:
	pnpm -C packages/schemas run gen
