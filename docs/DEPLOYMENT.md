# QuantVN Deployment Guide

This document provides comprehensive instructions for deploying QuantVN to production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Health Checks](#health-checks)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Docker**: 24.0+ with BuildKit support
- **Docker Compose**: 2.20+ (optional, for compose-based deployments)
- **Memory**: Minimum 1GB RAM, recommended 2GB+
- **CPU**: Minimum 1 core, recommended 2+ cores
- **Storage**: 5GB+ for container images and data

### Required Environment Variables

Before deployment, ensure you have the following environment variables configured:

| Variable | Description | Required |
|----------|-------------|----------|
| `GLM_API_KEY` | GLM AI API key for assistant features | Yes* |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI features | Yes* |

*At least one AI provider API key is required for assistant functionality.

---

## Environment Variables

### Core Application

```bash
# Node.js Environment
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
HOSTNAME=0.0.0.0

# Data Configuration
DATA_DIR=/app/public/data
DATA_BACKEND=auto
DATA_BACKEND_STRICT=false
DATA_DUCKDB_PATH=/app/public/data/quant_data.duckdb
DATA_ALLOW_RAW_FALLBACK=true
```

### AI Assistant Configuration

```bash
# Provider Priority (comma-separated)
ASSISTANT_PROVIDER_PRIORITY=openrouter,glm,fallback

# OpenRouter Settings
OPENROUTER_MODEL=openai/gpt-oss-120b:free
OPENROUTER_SECONDARY_MODEL=openai/gpt-oss-120b
OPENROUTER_TERTIARY_MODEL=openai/gpt-oss-20b:free
OPENROUTER_TIMEOUT_MS=90000

# GLM Settings
GLM_REQUEST_TIMEOUT_MS=90000
GLM_FALLBACK_TIMEOUT_MS=90000

# Assistant Behavior
ASSISTANT_POLICY_MODE=shadow
ASSISTANT_QUERY_PLAN_STRICT=true
ASSISTANT_TOOL_TIMEOUT_MS=30000
ASSISTANT_EVAL_RATE_LIMIT_MAX=240
```

### DuckDB Configuration

```bash
# Enable DuckDB for data queries
INSTALL_DUCKDB_BINDING=true
```

---

## Docker Deployment

### Quick Start

```bash
# Build the image
docker build -t quantvn-app:latest .

# Run the container
docker run -d \
  --name quantvn-app \
  -p 3000:3000 \
  --env-file .env.glm \
  -v $(pwd)/public/data:/app/public/data:ro \
  quantvn-app:latest
```

### Using Docker Compose (Production)

```bash
# Start production deployment
docker compose --profile prod up -d --build app-prod

# View logs
docker compose --profile prod logs -f app-prod

# Stop deployment
docker compose --profile prod down
```

### Multi-stage Build Details

The Dockerfile uses a multi-stage build for optimized image size:

1. **deps stage**: Installs all dependencies including devDependencies
2. **builder stage**: Builds the Next.js application with standalone output
3. **runner stage**: Minimal production image with only necessary files

**Estimated image size**: ~200-300MB (Alpine-based)

### Build Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `INSTALL_DUCKDB_BINDING` | `false` | Install DuckDB native binding |

Example with DuckDB:

```bash
docker build \
  --build-arg INSTALL_DUCKDB_BINDING=true \
  -t quantvn-app:latest .
```

---

## CI/CD Pipeline

### Pipeline Overview

The CI/CD pipeline consists of the following stages:

```
Build -> Test -> Lint -> Docker -> Deploy
```

### Workflow Triggers

| Event | Branches | Description |
|-------|----------|-------------|
| Push | main, master | Full pipeline with staging deployment |
| Tag | v* | Full pipeline with production deployment |
| Pull Request | main, master | Build, Test, Lint only |
| Manual | - | Deploy to selected environment |

### GitHub Actions Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| CI/CD Pipeline | `.github/workflows/ci.yml` | Main build, test, deploy pipeline |
| QA Integration | `.github/workflows/qa-integration.yml` | Integration tests with Docker |
| Nightly Gates | `.github/workflows/nightly-assistant-gates.yml` | AI assistant evaluation |

### Required GitHub Secrets

Configure these secrets in your repository settings:

| Secret | Description |
|--------|-------------|
| `GITHUB_TOKEN` | Automatic, used for package publishing |
| Custom secrets | API keys passed via environment |

### Deployment Environments

Configure GitHub environments for deployment protection:

1. **staging**: Auto-deploys on push to main/master
2. **production**: Deploys on version tags (v*)

---

## Health Checks

### Container Health Check

The Docker container includes a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health/data?probe=true&includeFundamentals=false')..."
```

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/health/data` | Data availability check |
| `/api/health/data?probe=true&includeFundamentals=false` | Lightweight probe |

### Manual Health Check

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' quantvn-app

# Manual endpoint check
curl http://localhost:3000/api/health/data?probe=true
```

---

## Security Considerations

### Container Security

1. **Non-root user**: Application runs as `nextjs` user (UID 1001)
2. **Read-only data**: Data volumes mounted as read-only
3. **No new privileges**: `no-new-privileges` security option enabled
4. **Minimal image**: Alpine-based for reduced attack surface

### Network Security

1. **Security headers**: Configured in `next.config.ts`
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - X-XSS-Protection: 1; mode=block

### Secrets Management

1. **Environment files**: Use `.env.glm` for local development
2. **Production secrets**: Use orchestration platform secrets
   - Docker Swarm: `docker secret`
   - Kubernetes: `Secret` resources
   - Cloud platforms: Use managed secret services

### Recommended Production Setup

```yaml
# docker-compose.prod.yml security options
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /app/.next/cache
```

---

## Troubleshooting

### Common Issues

#### Container fails to start

```bash
# Check logs
docker logs quantvn-app

# Common causes:
# 1. Missing environment variables
# 2. Data directory not mounted
# 3. Port already in use
```

#### Health check fails

```bash
# Test health endpoint directly
docker exec quantvn-app curl http://localhost:3000/api/health/data

# Check data availability
docker exec quantvn-app ls -la /app/public/data
```

#### DuckDB binding issues

```bash
# Rebuild with DuckDB support
docker build --build-arg INSTALL_DUCKDB_BINDING=true -t quantvn-app:latest .
```

### Debug Mode

```bash
# Run with debug logging
docker run -d \
  --name quantvn-app \
  -p 3000:3000 \
  -e NODE_ENV=development \
  -e DEBUG=* \
  --env-file .env.glm \
  quantvn-app:latest
```

### Performance Tuning

```yaml
# Resource limits in docker-compose.prod.yml
deploy:
  resources:
    limits:
      cpus: "2"
      memory: 2G
    reservations:
      cpus: "0.5"
      memory: 512M
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All environment variables configured
- [ ] Data files available and mounted
- [ ] API keys valid and have required quotas
- [ ] Health check endpoint accessible
- [ ] SSL/TLS certificates configured (if using reverse proxy)
- [ ] Resource limits configured
- [ ] Log aggregation configured
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place

---

## Support

For issues and questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review container logs: `docker logs quantvn-app`
3. Check GitHub Issues for known issues
4. Create a new issue with debug information
