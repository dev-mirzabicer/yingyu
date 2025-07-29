#!/bin/bash

# YingYu English Teaching App - Complete Setup Script
# This script sets up the entire application stack using Docker

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    log "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker Desktop and try again."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
    
    log "✅ Docker is installed and running"
}

# Clean up any existing containers
cleanup() {
    log "Cleaning up existing containers..."
    docker-compose down --volumes --remove-orphans 2>/dev/null || true
    docker system prune -f --volumes 2>/dev/null || true
    log "✅ Cleanup completed"
}

# Build and start services
start_services() {
    log "Building and starting services..."
    log "This may take a few minutes on first run..."
    
    # Start database first and wait for it to be ready
    docker-compose up -d database redis
    
    log "Waiting for database to be ready..."
    sleep 10
    
    # Wait for database to be healthy
    while ! docker-compose exec -T database pg_isready -U user -d english_app; do
        log "Waiting for database..."
        sleep 2
    done
    
    log "✅ Database is ready"
    
    # Start the main application
    docker-compose up -d app
    
    log "Waiting for application to start (this may take several minutes for npm install)..."
    sleep 15
    
    # Enhanced wait logic with better progress tracking
    log "Monitoring npm install progress..."
    for i in {1..120}; do  # Increased timeout for npm install
        # First check if npm install is still running
        if docker-compose logs app 2>/dev/null | tail -10 | grep -q "Installing dependencies"; then
            if [ $((i % 15)) -eq 0 ]; then  # Show progress every 30 seconds
                log "⏳ Still installing npm dependencies... (step $i/120)"
                # Show a sample of what's happening
                docker-compose logs --tail=3 app 2>/dev/null | sed 's/^/    /'
            fi
        elif docker-compose logs app 2>/dev/null | tail -5 | grep -q "Seeding database"; then
            log "📦 Dependencies installed! Now setting up Prisma and seeding..."
        elif curl -f http://localhost:3000/api/health &>/dev/null; then
            log "✅ Application is ready and healthy!"
            break
        fi
        
        if [ $i -eq 120 ]; then
            error "Application setup timed out. This might be due to slow npm install."
            error "Check logs with: docker-compose logs app"
            warn "If npm install is still running, you can wait longer or run 'make logs' to monitor progress"
            exit 1
        fi
        sleep 3
    done
}

# Display access information
show_access_info() {
    echo ""
    echo -e "${BLUE}🎉 YingYu English Teaching App is now running!${NC}"
    echo ""
    echo -e "${GREEN}📱 Application:${NC}      http://localhost:3000"
    echo -e "${GREEN}🗄️  Database Admin:${NC}   http://localhost:8080 (adminer)"
    echo -e "${GREEN}📊 Health Check:${NC}     http://localhost:3000/api/health"
    echo ""
    echo -e "${YELLOW}Database Credentials:${NC}"
    echo "  Server: database (or localhost:5433)"
    echo "  Username: user"
    echo "  Password: password"
    echo "  Database: english_app"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  View logs:          docker-compose logs -f"
    echo "  Stop services:      docker-compose down"
    echo "  Restart:            docker-compose restart"
    echo "  Clean restart:      ./scripts/setup.sh"
    echo "  Re-seed database:   make seed"
    echo "  All make commands:  make help"
    echo ""
    echo -e "${GREEN}Ready to teach! 🚀${NC}"
}

# Check for .env file
check_env() {
    if [ ! -f .env ]; then
        log "Creating .env file..."
        cat > .env << EOF
# YingYu English Teaching App Environment Variables
# Database Connection URL
DATABASE_URL="postgresql://user:password@localhost:5433/english_app"

# Worker Cron Secret
CRON_SECRET="KOjijwefewoijKMWOERIFJdl2034fnUGECKWOASW8ycjf"

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1

# Environment
NODE_ENV=development
EOF
        log "✅ Created .env file"
    else
        log "✅ .env file exists"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "██╗   ██╗██╗███╗   ██╗ ██████╗██╗   ██╗██╗   ██╗"
    echo "╚██╗ ██╔╝██║████╗  ██║██╔════╝╚██╗ ██╔╝██║   ██║"
    echo " ╚████╔╝ ██║██╔██╗ ██║██║  ███╗╚████╔╝ ██║   ██║"
    echo "  ╚██╔╝  ██║██║╚██╗██║██║   ██║ ╚██╔╝  ██║   ██║"
    echo "   ██║   ██║██║ ╚████║╚██████╔╝  ██║   ╚██████╔╝"
    echo "   ╚═╝   ╚═╝╚═╝  ╚═══╝ ╚═════╝   ╚═╝    ╚═════╝ "
    echo ""
    echo "English Teaching App - Complete Setup"
    echo -e "${NC}"
    
    log "Starting setup process..."
    
    check_docker
    check_env
    cleanup
    start_services
    show_access_info
}

# Handle script termination
trap 'error "Setup interrupted"; exit 1' INT TERM

# Run main function
main