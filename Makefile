.DEFAULT_GOAL := help
.PHONY: help build check run

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

build: ## Install dependencies from the lockfile
	npm ci

check: ## Syntax-check the server, compile the JSX client
	node --check server.js
	node --no-warnings check.mjs

run: ## Start the server on http://localhost:3000
	npm start
