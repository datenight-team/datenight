# Date Night — developer convenience targets
# Run `make` or `make help` to see available commands.

.DEFAULT_GOAL := help

# ── Setup ────────────────────────────────────────────────────────────────────

.PHONY: install
install: ## Install dependencies
	npm install

.PHONY: setup
setup: install ## Full first-time setup: install deps, init DB, create .env.local
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo "✓ Created .env.local — fill in your API keys before running"; \
	else \
		echo "✓ .env.local already exists"; \
	fi
	@mkdir -p data
	DATABASE_URL=file:./data/datenight.db npx prisma migrate dev --name init 2>/dev/null || \
		DATABASE_URL=file:./data/datenight.db npx prisma migrate deploy
	DATABASE_URL=file:./data/datenight.db npx prisma generate
	@echo ""
	@echo "Setup complete. Edit .env.local then run: make dev"

# ── Development ───────────────────────────────────────────────────────────────

.PHONY: dev
dev: ## Start the local dev server (http://localhost:3000)
	npm run dev

.PHONY: db-studio
db-studio: ## Open Prisma Studio — browser GUI for the local database (localhost:5555)
	DATABASE_URL=file:./data/datenight.db npx prisma studio

.PHONY: db-migrate
db-migrate: ## Create and apply a new migration (usage: make db-migrate name=your-migration-name)
	DATABASE_URL=file:./data/datenight.db npx prisma migrate dev --name $(name)

.PHONY: db-reset
db-reset: ## Wipe the local database and re-apply all migrations
	@echo "This will delete all local data. Press Ctrl-C to cancel, Enter to continue."
	@read _confirm
	rm -f data/datenight.db
	DATABASE_URL=file:./data/datenight.db npx prisma migrate deploy
	DATABASE_URL=file:./data/datenight.db npx prisma generate

.PHONY: import
import: ## Import movies from a CSV file (usage: make import file=~/Downloads/films.csv)
	npm run import -- $(file)

# ── Quality ───────────────────────────────────────────────────────────────────

.PHONY: test
test: ## Run tests in watch mode
	npm test

.PHONY: test-run
test-run: ## Run all tests once
	npm run test:run

.PHONY: lint
lint: ## Run ESLint
	npm run lint

.PHONY: typecheck
typecheck: ## Run TypeScript type checker
	npx tsc --noEmit

.PHONY: check
check: test-run lint typecheck build ## Run all checks (tests + lint + types + build)

# ── Build ─────────────────────────────────────────────────────────────────────

.PHONY: build
build: ## Build the production Next.js app
	npm run build

.PHONY: start
start: ## Start the production server locally (requires: make build first)
	npm start

# ── Docker ────────────────────────────────────────────────────────────────────

.PHONY: docker-build
docker-build: ## Build the Docker image
	docker build -t datenight .

.PHONY: docker-up
docker-up: ## Start the app via docker compose (detached)
	docker compose up -d

.PHONY: docker-down
docker-down: ## Stop docker compose services
	docker compose down

.PHONY: docker-logs
docker-logs: ## Tail logs from the running container
	docker logs -f datenight

.PHONY: docker-shell
docker-shell: ## Open a shell inside the running container
	docker exec -it datenight sh

.PHONY: docker-import
docker-import: ## Import a CSV into the production container (usage: make docker-import file=/path/to/films.csv)
	docker cp $(file) datenight:/app/data/_import.csv
	docker exec datenight node_modules/.bin/tsx scripts/import-csv.ts /app/data/_import.csv
	docker exec datenight rm /app/data/_import.csv

# ── Help ──────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
