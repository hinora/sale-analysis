# Docker Deployment Guide

This guide covers Docker Compose setup, configuration, and deployment for the Export Goods Analysis application.

## Architecture

The application uses Docker Compose to orchestrate three services:

```
┌─────────────────────────────────────────────────────┐
│          Docker Compose Network                     │
│          (export-goods-network)                     │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   Next.js    │  │   MongoDB    │  │  Ollama  │ │
│  │  Application │  │   Database   │  │    AI    │ │
│  │  :3000       │  │   :27017     │  │  :11434  │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│         │                 │                 │       │
│         └─────────────────┴─────────────────┘       │
│              Internal Bridge Network                │
└─────────────────────────────────────────────────────┘
              ↓              ↓              ↓
         localhost      localhost      localhost
           :3000         :27017         :11434
```

## Services

### 1. App Service (Next.js)
- **Image**: Custom build from Dockerfile
- **Port**: 3000
- **Environment**: Development with hot-reload or production optimized
- **Volumes**: 
  - `./src:/app/src` - Source code hot-reload
  - `./public:/app/public` - Static assets
  - `./specs:/app/specs` - Documentation
  - `/app/node_modules` - Anonymous volume
  - `/app/.next` - Build cache

### 2. MongoDB Service
- **Image**: `mongo:7`
- **Port**: 27017
- **Volumes**: 
  - `mongodb-data:/data/db` - Database persistence
  - `mongodb-config:/data/configdb` - Configuration persistence
- **Health Check**: `mongosh --eval "db.adminCommand('ping')"`

### 3. Ollama Service
- **Image**: `ollama/ollama:latest`
- **Port**: 11434
- **Volumes**: 
  - `ollama-data:/root/.ollama` - Model storage (~8GB)
- **Health Check**: `curl -f http://localhost:11434`
- **GPU Support**: Optional (NVIDIA)

### 4. Ollama-Setup Service (One-time)
- **Purpose**: Download AI models on first run
- **Models**: deepseek-r1:1.5b (development), deepseek-r1:8b (production)
- **Restart**: Never (exits after completion)

## Quick Start

### First-Time Setup

```bash
# Clone repository
git clone <repository-url>
cd sale-analysis

# Copy environment file
cp .env.docker .env

# Build and start all services
docker-compose up --build
```

**First run takes 10-15 minutes** to:
1. Build Next.js container (~5 minutes)
2. Download Ollama models (~8GB, 5-10 minutes depending on internet speed)

### Subsequent Runs

```bash
# Start services (much faster, <30 seconds)
docker-compose up

# Or run in background
docker-compose up -d
```

## Common Commands

### Service Management

```bash
# Start all services
docker-compose up

# Start in detached mode (background)
docker-compose up -d

# Stop all services (preserves data)
docker-compose down

# Stop and remove volumes (CAUTION: deletes all data)
docker-compose down -v

# Restart a specific service
docker-compose restart app

# View status
docker-compose ps

# View resource usage
docker stats
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs app
docker-compose logs mongodb
docker-compose logs ollama

# View last 100 lines
docker-compose logs --tail=100 app
```

### Building

```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build app

# Rebuild and start (force rebuild)
docker-compose up --build

# Build without cache
docker-compose build --no-cache
```

### Accessing Services

```bash
# Execute command in running container
docker-compose exec app npm run lint
docker-compose exec mongodb mongosh
docker-compose exec ollama ollama list

# Open shell in container
docker-compose exec app sh
docker-compose exec mongodb bash

# View container details
docker-compose exec app node --version
docker-compose exec mongodb mongod --version
```

## Environment Configuration

### Development (.env)

```env
NODE_ENV=development
MONGODB_URI=mongodb://mongodb:27017/export-goods
OLLAMA_HOST=http://ollama:11434
NEXT_TELEMETRY_DISABLED=1
```

### Production (.env.production)

```env
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/export-goods
OLLAMA_HOST=http://ollama:11434
NEXT_TELEMETRY_DISABLED=1

# Add production-specific variables
SESSION_SECRET=<generate-secure-random-string>
MONGODB_USER=admin
MONGODB_PASSWORD=<secure-password>
```

### Using Environment File

```bash
# Use specific env file
docker-compose --env-file .env.production up

# Override single variable
MONGODB_URI=mongodb://custom-host:27017/db docker-compose up
```

## Volumes

### Named Volumes

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect sale-analysis_mongodb-data

# Backup MongoDB volume
docker run --rm -v sale-analysis_mongodb-data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/mongodb-backup.tar.gz /data

# Restore MongoDB volume
docker run --rm -v sale-analysis_mongodb-data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/mongodb-backup.tar.gz -C /

# Remove specific volume (CAUTION: deletes data)
docker volume rm sale-analysis_mongodb-data

# Remove all unused volumes
docker volume prune
```

## Database Management

### MongoDB Shell Access

```bash
# Open MongoDB shell
docker-compose exec mongodb mongosh export-goods

# Run command directly
docker-compose exec mongodb mongosh export-goods --eval "db.transactions.countDocuments()"
```

### MongoDB Compass Connection

Use MongoDB Compass GUI to connect:
- **Connection String**: `mongodb://localhost:27017`
- **Database**: `export-goods`

### Backup and Restore

```bash
# Backup database
docker-compose exec mongodb mongodump --db=export-goods --out=/tmp/backup
docker cp export-goods-mongodb:/tmp/backup ./mongodb-backup

# Restore database
docker cp ./mongodb-backup export-goods-mongodb:/tmp/backup
docker-compose exec mongodb mongorestore --db=export-goods /tmp/backup/export-goods
```

## Ollama Management

### Model Operations

```bash
# List installed models
docker-compose exec ollama ollama list

# Pull additional model
docker-compose exec ollama ollama pull deepseek-r1:8b

# Remove model
docker-compose exec ollama ollama rm deepseek-r1:1.5b

# Test model
docker-compose exec ollama ollama run deepseek-r1:1.5b "Hello, how are you?"
```

### Model Storage

Models are stored in the `ollama-data` volume:
- **deepseek-r1:1.5b**: ~1GB
- **deepseek-r1:8b**: ~4.5GB
- Total: ~9GB (both models)

```bash
# Check volume size
docker system df -v | grep ollama-data
```

## Production Deployment

### Production Build

```bash
# Build production image
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Production docker-compose.prod.yml

Create `docker-compose.prod.yml` for production overrides:

```yaml
version: '3.8'

services:
  app:
    build:
      target: production
    restart: always
    environment:
      - NODE_ENV=production

  mongodb:
    restart: always
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=${MONGODB_PASSWORD}

  ollama:
    restart: always
    deploy:
      resources:
        limits:
          memory: 8G
```

### SSL/TLS with Nginx

Add nginx service to docker-compose:

```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
```

## GPU Support for Ollama

### Enable NVIDIA GPU

Uncomment GPU section in `docker-compose.yml`:

```yaml
  ollama:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### Prerequisites

```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Verify GPU Access

```bash
docker-compose exec ollama nvidia-smi
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker-compose logs app

# Check if ports are available
lsof -ti:3000 -ti:27017 -ti:11434

# Remove and recreate containers
docker-compose down
docker-compose up --force-recreate
```

### Out of Disk Space

```bash
# Check disk usage
docker system df

# Clean up
docker system prune -a --volumes  # CAUTION: removes all unused resources
docker volume prune               # Remove unused volumes only
docker image prune -a             # Remove unused images only
```

### MongoDB Connection Refused

```bash
# Check MongoDB health
docker-compose ps mongodb

# Restart MongoDB
docker-compose restart mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Verify network
docker network inspect sale-analysis_export-goods-network
```

### Ollama Models Not Working

```bash
# Check model list
docker-compose exec ollama ollama list

# Re-download models
docker-compose exec ollama ollama pull deepseek-r1:1.5b
docker-compose exec ollama ollama pull deepseek-r1:8b

# Check Ollama logs
docker-compose logs ollama
```

### Hot Reload Not Working

```bash
# Verify volume mounts
docker-compose exec app ls -la /app/src

# Restart app service
docker-compose restart app

# Check for file permission issues (macOS/Linux)
ls -la src/
```

### Container Uses Too Much Memory

```bash
# Set memory limits in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

## Performance Optimization

### Build Cache

```bash
# Use BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build
```

### Multi-Stage Builds

The Dockerfile already uses multi-stage builds:
- **deps**: Dependencies only (~500MB)
- **development**: With source code and dev dependencies (~600MB)
- **production**: Optimized standalone build (~150MB)

### Layer Caching

To optimize builds:
1. Copy `package.json` first (changes infrequently)
2. Run `npm ci` (caches if package.json unchanged)
3. Copy source code (changes frequently)

## Monitoring

### Resource Usage

```bash
# Real-time stats
docker stats

# Specific service stats
docker stats export-goods-app

# Disk usage
docker system df -v
```

### Health Checks

```bash
# Check service health
docker-compose ps

# Manual health check
curl http://localhost:3000/api/health
curl http://localhost:11434/api/version
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Docker Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker images
        run: docker-compose build
      
      - name: Run tests
        run: docker-compose run app npm test
      
      - name: Deploy
        run: docker-compose up -d
```

## Security Best Practices

1. **Use secrets for sensitive data**:
   ```bash
   docker secret create mongodb_password ./password.txt
   ```

2. **Enable MongoDB authentication** (production):
   ```yaml
   environment:
     - MONGO_INITDB_ROOT_USERNAME=admin
     - MONGO_INITDB_ROOT_PASSWORD_FILE=/run/secrets/mongodb_password
   ```

3. **Run containers as non-root** (already configured in Dockerfile)

4. **Keep images updated**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

5. **Use .dockerignore** to exclude sensitive files

6. **Scan images for vulnerabilities**:
   ```bash
   docker scan export-goods-app
   ```

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [MongoDB Docker Image](https://hub.docker.com/_/mongo)
- [Ollama Docker Documentation](https://github.com/ollama/ollama/blob/main/docs/docker.md)

---

**Last Updated**: 2025-11-20  
**Version**: 1.0.0
