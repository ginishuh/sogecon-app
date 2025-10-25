.PHONY: venv api-install db-up db-down db-test-up api-dev web-dev schema-gen test-api info-venv \
        api-start api-stop api-restart api-status \
        web-start web-stop web-restart web-status \
        dev-up dev-down dev-status \
        db-reset db-test-reset db-reset-all api-migrate api-migrate-test \
        seed-data

# Detect active virtualenv; fallback to project-local .venv
VENV_DIR ?= $(if $(VIRTUAL_ENV),$(VIRTUAL_ENV),.venv)
VENV_BIN := $(VENV_DIR)/bin
DB_DEV_PORT ?= 5433
DB_TEST_PORT ?= 5434

# Helper function to wait for PostgreSQL service health (fallback to pg_isready)
# - 먼저 compose 컨테이너의 Health.Status가 healthy가 될 때까지 대기
# - 헬스체크를 사용할 수 없는 환경에서는 컨테이너 내부의 pg_isready로 대기
# - 타임아웃은 WAIT_FOR_PG_TIMEOUT(기본 90초)
define wait_for_pg
	@echo "[db] Waiting for $(1) to be healthy..."
	@CID=$$(docker compose -f infra/docker-compose.dev.yml ps -q $(1)); \
	if [ -z "$$CID" ]; then \
		echo "[db] Error: container for $(1) not found"; exit 1; \
	fi; \
	END=$$(( $${SECONDS:-0} + $${WAIT_FOR_PG_TIMEOUT:-90} )); \
	OK=0; \
	while [ $${SECONDS:-0} -lt $$END ]; do \
		STATE=$$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' $$CID 2>/dev/null || echo unknown); \
		if [ "$$STATE" = "healthy" ]; then OK=1; break; fi; \
		sleep 2; \
	done; \
	if [ $$OK -eq 1 ]; then \
		echo "[db] $(1) is healthy"; \
	else \
		echo "[db] Health not healthy in time; fallback to pg_isready..."; \
		timeout $${WAIT_FOR_PG_TIMEOUT:-60} bash -c 'until docker compose -f infra/docker-compose.dev.yml exec -T $(1) pg_isready -U app -d $(2) >/dev/null 2>&1; do sleep 2; done' || { \
			echo "[db] Timeout waiting for $(1) to be ready"; exit 1; \
		}; \
	fi
endef

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
	$(call wait_for_pg,postgres,appdb)
	$(call wait_for_pg,postgres_test,appdb_test)
	@echo "[db] PostgreSQL containers are ready (dev:5433, test:5434)"

db-down:
	docker compose -f infra/docker-compose.dev.yml down

db-test-up:
	docker compose -f infra/docker-compose.dev.yml up -d postgres_test

# --- Schema reset helpers (DANGER) ---
db-reset: db-up
	@echo "[db] Dropping and recreating schema 'public' on dev DB (localhost:$(DB_DEV_PORT)/appdb)"
	docker compose -f infra/docker-compose.dev.yml exec -T postgres psql -U app -d appdb -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO app; GRANT ALL ON SCHEMA public TO public;"
	@echo "[db] Done. You can now run: make api-migrate"

db-test-reset: db-test-up
	@echo "[db] Dropping and recreating schema 'public' on test DB (localhost:$(DB_TEST_PORT)/appdb_test)"
	docker compose -f infra/docker-compose.dev.yml exec -T postgres_test psql -U app -d appdb_test -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO app; GRANT ALL ON SCHEMA public TO public;"
	@echo "[db] Done. You can now run: make api-migrate-test"

db-reset-all: db-reset db-test-reset
	@echo "[db] Both dev and test schemas were reset."

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
	@cd apps/api && nohup "$(VENV_BIN)/uvicorn" main:app --reload --port 3001 > ../../logs/api-dev.log 2>&1 & echo $$! > ../../.api-dev.pid
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

# --- Migrations ---
api-migrate:
	@if [ ! -x "$(VENV_BIN)/alembic" ]; then \
		echo "[make] alembic not found in '$(VENV_BIN)'. Run 'make api-install'."; \
		exit 1; \
	fi
	"$(VENV_BIN)/alembic" -c apps/api/alembic.ini upgrade head

api-migrate-test:
	@if [ ! -x "$(VENV_BIN)/alembic" ]; then \
		echo "[make] alembic not found in '$(VENV_BIN)'. Run 'make api-install'."; \
		exit 1; \
	fi
	DB_URL=postgresql+psycopg://app:devpass@localhost:$(DB_TEST_PORT)/appdb_test; \
	DATABASE_URL="$$DB_URL" "$(VENV_BIN)/alembic" -c apps/api/alembic.ini upgrade head

seed-data:
	@if [ ! -x "$(VENV_BIN)/python" ]; then \
		echo "[make] Python not found in '$(VENV_BIN)'. Run 'make venv' and 'make api-install'."; \
		exit 1; \
	fi
	@echo "[seed] Creating seed data..."
	"$(VENV_BIN)/python" -m apps.api.seed_data
