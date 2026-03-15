# Cloudify.ro Scale Configuration for 100k+ Products

This guide outlines the specific hardware and software configuration required to run the ERP system at scale on Cloudify.ro infrastructure.

## 1. System Requirements Analysis

For **100,000+ products** and **10+ API integrations** (SmartBill, WooCommerce, TikTok, Google Shopping, etc.), a split-architecture is **mandatory**. A single server will likely bottleneck on Database I/O or Search queries during peak traffic or bulk sync operations.

### Critical Components needing Scale

1. **Search Engine (MeiliSearch)**:
    - Postgres `ILIKE` queries are too slow for 100k rows with multiple facets (B2B prices, stock, attributes).
    - Requires significant RAM to keep indexes in memory.
2. **Database (PostgreSQL)**:
    - Heavy write load during product sync (upserts).
    - Complex B2B pricing logic (complex joins).
3. **Background Jobs (Redis + BullMQ)**:
    - 10+ APIs mean constant background synchronization tasks.
    - Requires robust queue processing.

## 2. Recommended Cloudify.ro Architecture

We recommend a **Tiered Architecture** using Cloudify's VPS instances.

### Option A: Performance & Redundancy (Recommended)

| Role | Spec Recommendation | Estimated Cost (approx) | Notes |
| :--- | :--- | :--- | :--- |
| **App Server (Node.js)** | **8 vCPU / 16 GB RAM** | ~€20-30/mo | Runs API + BullMQ Workers. Handles concurrent B2B users. |
| **Database (PostgreSQL)** | **8 vCPU / 32 GB RAM** | ~€40-50/mo | Dedicated DB. High RAM for caching B2B pricing rules. NVMe storage essential. |
| **Search (MeiliSearch)** | **4 vCPU / 8 GB RAM** | ~€15/mo | Dedicated Search instance. 100k products index size is <500MB but needs RAM for speed. |
| **Redis (Cache/Queues)** | **2 vCPU / 4 GB RAM** | ~€10/mo | Dedicated for Caching + Job Queues. Prevents cache eviction from affecting queues. |
| **Load Balancer** | **Software LB (Nginx)** | Included on App Server | Or separate small VPS (1 vCPU) if scaling to 2+ App Servers. |

**Total Estimated Monthly Config:** ~€85 - €100 / month

### Option B: Cost-Optimized (Start Here)

A powerful single-server "Monolith" to start, but separated via Docker containers for easy migration later.

| Role | Spec Recommendation | Notes |
| :--- | :--- | :--- |
| **All-in-One VPS** | **12 vCPU / 48 GB RAM** | Run all Docker containers on one host. Ensure NVMe storage. |

**Estimated Cost:** ~€60-80 / month

## 3. Deployment Configuration

### Docker Compose (Updated)

The `docker-compose.yml` has been updated to include:

- `meilisearch`: Image `getmeili/meilisearch:v1.6`.
- `redis`: Optimized for queue persistence.
- `postgres`: Tuned shared buffers.

### Performance Tuning Tips

1. **PostgreSQL**:
    - Set `shared_buffers = 8GB` (25% of 32GB RAM).
    - Set `work_mem = 32MB` for complex B2B pricing queries.
    - Enable `pg_trgm` extension for legacy search (fallback).

2. **MeiliSearch**:
    - API Key: Secure purely with `MEILI_MASTER_KEY` in `.env`.
    - Snapshot interval: 1 hour.

3. **Node.js**:
    - Run in **Cluster Mode** (pm2 or native cluster) to utilize all 8 vCPUs.
    - Set `UV_THREADPOOL_SIZE=8` for heavy crypto/fs operations.

## 4. Installation Steps on Cloudify.ro

1. **Provision VPS**: Specify "Ubuntu 22.04 LTS" or "Debian 12".
2. **DNS Setup**: Point `erp.ledux.ro` to the VPS IP.
3. **Initial Security**:

    ```bash
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw enable
    ```

4. **Install Docker & Compose**:

    ```bash
    curl -fsSL https://get.docker.com | sh
    ```

5. **Deploy**:

    ```bash
    git clone ...
    cp .env.example .env
    # Edit .env with secure passwords and MeiliSearch key
    docker compose up -d --build
    ```
