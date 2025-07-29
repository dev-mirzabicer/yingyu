# YingYu English Teaching App - Makefile
# Simplifies common development tasks

.PHONY: help setup start stop restart logs clean dev build lint test health

# Default target
help: ## Show this help message
	@echo "YingYu English Teaching App - Available Commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

setup: ## Complete application setup with Docker
	@echo "🚀 Setting up YingYu English Teaching App..."
	@./scripts/setup.sh

start: ## Start all services
	@echo "▶️  Starting services..."
	@docker-compose up -d
	@echo "✅ Services started. App available at http://localhost:3000"

stop: ## Stop all services
	@echo "⏹️  Stopping services..."
	@docker-compose down
	@echo "✅ Services stopped"

restart: ## Restart all services
	@echo "🔄 Restarting services..."
	@docker-compose restart
	@echo "✅ Services restarted"

logs: ## Show application logs
	@docker-compose logs -f

clean: ## Clean up containers and volumes
	@echo "🧹 Cleaning up..."
	@docker-compose down --volumes --remove-orphans
	@docker system prune -f --volumes
	@echo "✅ Cleanup completed"

nuke: ## Nuclear cleanup - use if regular cleanup fails
	@echo "💥 Nuclear cleanup (removes ALL Docker data)..."
	@docker stop $$(docker ps -aq) 2>/dev/null || true
	@docker rm $$(docker ps -aq) 2>/dev/null || true
	@docker rmi $$(docker images -q) 2>/dev/null || true
	@docker volume prune -f
	@docker network prune -f
	@docker system prune -af --volumes
	@echo "💀 Nuclear cleanup completed - Docker is now pristine"

dev: ## Start development server (local)
	@echo "💻 Starting development server..."
	@npm run dev

build: ## Build the application
	@echo "🏗️  Building application..."
	@npm run build

lint: ## Run linting
	@echo "🔍 Running linter..."
	@npm run lint

test: ## Run tests
	@echo "🧪 Running tests..."
	@npm run test:e2e

health: ## Check application health
	@echo "🩺 Checking application health..."
	@curl -f http://localhost:3000/api/health | jq . || echo "❌ Application is not healthy"

status: ## Show service status
	@echo "📊 Service Status:"
	@docker-compose ps

db: ## Open database admin interface
	@echo "🗄️  Opening database admin..."
	@open http://localhost:8080

app: ## Open application in browser
	@echo "📱 Opening application..."
	@open http://localhost:3000

# Development shortcuts
up: start ## Alias for start
down: stop ## Alias for stop
reset: clean setup ## Clean everything and setup fresh

# Additional development commands
seed: ## Run database seeding only
	@echo "🌱 Seeding database..."
	@docker-compose exec app node prisma/seed.js

logs-app: ## Show application logs only
	@echo "📜 Application logs:"
	@docker-compose logs -f app

logs-db: ## Show database logs only
	@echo "📜 Database logs:"
	@docker-compose logs -f database

exec-app: ## Open shell in app container
	@echo "🐚 Opening shell in app container..."
	@docker-compose exec app sh

exec-db: ## Open PostgreSQL shell
	@echo "🐚 Opening PostgreSQL shell..."
	@docker-compose exec database psql -U user -d english_app

studio: ## Open Prisma Studio (local)
	@echo "🎨 Opening Prisma Studio..."
	@npx prisma studio

migrate: ## Create new migration (local)
	@echo "🗄️  Creating new migration..."
	@npx prisma migrate dev

quick-test: ## Quick health check test
	@echo "🏥 Running quick health check..."
	@curl -f http://localhost:3000/api/health | jq . || echo "❌ Health check failed"

rebuild: ## Rebuild containers without cache
	@echo "🔨 Rebuilding containers..."
	@docker-compose build --no-cache
	@docker-compose up -d

inspect: ## Show detailed container information
	@echo "🔍 Container inspection:"
	@docker-compose ps -a
	@echo ""
	@echo "📊 Resource usage:"
	@docker stats --no-stream yingyu-app yingyu-postgres yingyu-redis 2>/dev/null || echo "Containers not running"

# Production commands (using Dockerfile)
prod-build: ## Build production image using Dockerfile
	@echo "🏗️  Building production image..."
	@docker-compose build app-prod

prod-start: ## Start production services (using Dockerfile)
	@echo "🚀 Starting production services..."
	@docker-compose --profile production up -d

prod-stop: ## Stop production services
	@echo "⏹️  Stopping production services..."
	@docker-compose --profile production down

prod-logs: ## Show production logs
	@echo "📜 Production logs:"
	@docker-compose logs -f app-prod