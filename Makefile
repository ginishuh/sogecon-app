.PHONY: venv api-install db-up db-down db-test-up api-dev web-dev schema-gen test-api info-venv \
        api-start api-stop api-restart api-status \
        web-start web-stop web-restart web-status \
        dev-up dev-down dev-status

# Detect active virtualenv; fallback to project-local .venv
VENV_DIR ?= $(if $(VIRTUAL_ENV),$(VIRTUAL_ENV),.venv)
VENV_BIN := $(VENV_DIR)/bin

venv:
	python -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip

api-install:
	@if [ ! -x "$(VENV_BIN)/python" ]; then \
		echo "[make] No active venv detected at '$(VENV_DIR)'. Create one with 'make venv' or activate your venv, then retry."; \
		exit 1; \
	fi
	"$(VENV_BIN)/pip" install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt

db-up:
	@echo "[db] Starting PostgreSQL containers..."
	@docker compose -f infra/docker-compose.dev.yml up -d postgres postgres_test || { \
		echo "[db] Failed to start containers. Checking Docker status..."; \
		docker version >/dev/null 2>&1 || { echo "[db] Error: Docker is not running. Please start Docker first."; exit 1; }; \
		exit 1; \
	}
	@echo "[db] Waiting for databases to be ready..."
	@timeout 60 bash -c 'until docker compose -f infra/docker-compose.dev.yml exec -T postgres pg_isready -U app -d appdb >/dev/null 2>&1; do sleep 2; done' || { \
		echo "[db] Timeout waiting for postgres to be ready"; exit 1; \
	}
	@timeout 60 bash -c 'until docker compose -f infra/docker-compose.dev.yml exec -T postgres_test pg_isready -U app -d appdb_test >/dev/null 2>&1; do sleep 2; done' || { \
		echo "[db] Timeout waiting for postgres_test to be ready"; exit 1; \
	}
	@echo "[db] PostgreSQL containers are ready (dev:5433, test:5434)"

db-down:
	docker compose -f infra/docker-compose.dev.yml down

db-test-up:
	docker compose -f infra/docker-compose.dev.yml up -d postgres_test

api-dev: db-up
	@if [ ! -x "$(VENV_BIN)/uvicorn" ]; then \
		echo "[make] uvicorn not found in '$(VENV_BIN)'. Run 'make api-install' or check your active venv."; \
		exit 1; \
	fi
	"$(VENV_BIN)/uvicorn" apps.api.main:app --reload --port 3001 --reload-dir apps/api

web-dev:
	pnpm -C apps/web dev

# --- Detached dev helpers (background with logs) ---
api-start: db-up
	@if [ ! -x "$(VENV_BIN)/uvicorn" ]; then \
		echo "[make] uvicorn not found in '$(VENV_BIN)'. Run 'make api-install' or check your active venv."; \
		exit 1; \
	fi
	@mkdir -p logs
	@nohup "$(VENV_BIN)/uvicorn" apps.api.main:app --reload --port 3001 --reload-dir apps/api > logs/api-dev.log 2>&1 & echo $$! > .api-dev.pid
	@echo "[api] started (pid $$(cat .api-dev.pid)) → logs/api-dev.log"

api-stop:
	@if [ -f .api-dev.pid ]; then \
		PID=$$(cat .api-dev.pid); \
		if ps -p $$PID >/dev/null 2>&1; then kill $$PID || true; sleep 1; fi; \
		rm -f .api-dev.pid; \
		echo "[api] stopped"; \
	else \
		echo "[api] no pid file; nothing to stop"; \
	fi

api-restart: api-stop api-start

api-status:
	@echo "[api] pid file:" $$(test -f .api-dev.pid && cat .api-dev.pid || echo none)
	@echo "[api] listening on :3001?" && (command -v lsof >/dev/null 2>&1 && lsof -i :3001 -sTCP:LISTEN || ss -ltnp | grep ':3001' || true)

web-start:
	@mkdir -p logs
	@nohup pnpm -C apps/web dev > logs/web-dev.log 2>&1 & echo $$! > apps/web/.web-dev.pid
	@echo "[web] started (pid $$(cat apps/web/.web-dev.pid)) → logs/web-dev.log"

web-stop:
	@if [ -f apps/web/.web-dev.pid ]; then \
		PID=$$(cat apps/web/.web-dev.pid); \
		if ps -p $$PID >/dev/null 2>&1; then kill $$PID || true; sleep 1; fi; \
		rm -f apps/web/.web-dev.pid; \
		echo "[web] stopped"; \
	else \
		echo "[web] no pid file; nothing to stop"; \
	fi

web-restart: web-stop web-start

web-status:
	@echo "[web] pid file:" $$(test -f apps/web/.web-dev.pid && cat apps/web/.web-dev.pid || echo none)
	@echo "[web] listening on :3000?" && (command -v lsof >/dev/null 2>&1 && lsof -i :3000 -sTCP:LISTEN || ss -ltnp | grep ':3000' || true)

dev-up: db-up api-start web-start
dev-down: api-stop web-stop
dev-status: api-status web-status

schema-gen:
	pnpm -C packages/schemas run gen

test-api:
	@if [ ! -x "$(VENV_BIN)/pytest" ]; then \
		echo "[make] pytest not found in '$(VENV_BIN)'. Run 'make api-install' or check your active venv."; \
		exit 1; \
	fi
	"$(VENV_BIN)/pytest" -q

info-venv:
	@echo "Detected VENV_DIR=$(VENV_DIR)" && echo "Using BIN=$(VENV_BIN)"
