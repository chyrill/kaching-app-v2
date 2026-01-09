#!/bin/bash
set -e

echo "🚀 Setting up kaching development environment..."
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not installed."
  echo "   Install from: https://docker.com/products/docker-desktop"
  exit 1
fi

# Check Docker daemon
if ! docker info &> /dev/null; then
  echo "❌ Docker daemon not running."
  echo "   Start Docker Desktop and try again."
  exit 1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm not installed."
  echo "   Install with: npm install -g pnpm"
  exit 1
fi

# Check port 5432 (PostgreSQL)
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo "⚠️  Port 5432 already in use (PostgreSQL)"
  echo "   Stop conflicting service or change port in docker-compose.yml"
  echo "   macOS: brew services stop postgresql"
  echo "   Linux: sudo systemctl stop postgresql"
  exit 1
fi

# Check port 6379 (Redis)
if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo "⚠️  Port 6379 already in use (Redis)"
  echo "   Stop conflicting service or change port in docker-compose.yml"
  echo "   macOS: brew services stop redis"
  echo "   Linux: sudo systemctl stop redis"
  exit 1
fi

# Start Docker services
echo "📦 Starting PostgreSQL 16 and Redis 7 with Docker Compose..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if docker-compose ps | grep -q "healthy"; then
    postgres_healthy=$(docker-compose ps postgres | grep -q "healthy" && echo "yes" || echo "no")
    redis_healthy=$(docker-compose ps redis | grep -q "healthy" && echo "yes" || echo "no")
    
    if [ "$postgres_healthy" = "yes" ] && [ "$redis_healthy" = "yes" ]; then
      break
    fi
  fi
  
  attempt=$((attempt + 1))
  sleep 2
  echo "   Still waiting... ($attempt/$max_attempts)"
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ Services failed to become healthy after 60 seconds"
  echo "   Check logs: docker-compose logs"
  exit 1
fi

# Create storage directory
mkdir -p ./storage
echo "✅ Storage directory ready"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run: pnpm dev"
echo "  2. Open: http://localhost:3000"
echo ""
echo "Services running:"
echo "  • PostgreSQL: localhost:5432"
echo "  • Redis: localhost:6379"
echo ""
echo "Useful commands:"
echo "  • Stop services: docker-compose down"
echo "  • Reset data: docker-compose down -v"
echo "  • View logs: docker-compose logs -f"
echo ""
