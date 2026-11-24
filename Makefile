.DEFAULT_GOAL := help
.PHONY: help install build check dev api run

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-9s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies from the lockfile
	npm ci

build: ## Build the client into dist/
	npm run build

check: ## Type-check the client, syntax-check the server
	npm run typecheck
	node --check server/index.js
	node --check server/store.js

dev: ## Vite dev server on :5173 (proxies /api to :3000)
	npm run dev

api: ## API server on :3000, dev only
	npm run api

run: build ## Build, then serve client and API together on :3000
	npm run api
