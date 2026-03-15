# CYPHER ERP — Ghid Infrastructura si Deployment

Versiune: 2.0
Data: Februarie 2026
Status: Production Ready
Autor: DevOps Team Ledux

---

## 1. CERINTE SISTEM

### 1.1 Stack Tehnologic
- **Backend**: Node.js 20 LTS, TypeScript, Express.js
- **Database**: PostgreSQL 15 (minim 8GB RAM dedicat)
- **Cache**: Redis 7 (minim 2GB RAM)
- **Job Queue**: BullMQ (ruleaza pe Redis)
- **Frontend**: Static files (Vite build, ~5MB compresate)
- **Web Server**: Nginx (reverse proxy + static files)
- **Storage**: Minim 100GB SSD/NVMe (DB + logs + uploads)

### 1.2 Performanta & Disponibilitate
- **Bandwidth**: ~5TB/luna estimat (ERP cu 50-200 utilizatori)
- **Latenta**: <30ms catre clienti din Romania
- **Uptime SLA**: 99.9%+ (maxim 43 minute downtime/luna)
- **Concurenta**: 50-200 utilizatori simultani
- **RTO**: 1 ora (Recovery Time Objective)
- **RPO**: 24 ore (Recovery Point Objective)

### 1.3 Conformitate Legala
- **GDPR**: Obligatoriu (date clienti romani)
- **ISO 27001**: Recomandat
- **LGPD-compliant**: Daca se extinde in Brazilia
- **Backup**: Zilnic automat, retentie 30 zile
- **Encryption**: TLS 1.3 in transit, AES-256 at rest (optional)
- **Audit logs**: Toate operatiile critice logare + 90 zile retentie

### 1.4 Resurse Minime pe Server
```
App Server (Node.js):
  - CPU: 4 vCPU (minim 2)
  - RAM: 16GB (minim 8GB)
  - Disk: 50GB SSD (minim 30GB)

Database Server (PostgreSQL):
  - CPU: 8 vCPU (minim 2, dar suboptim)
  - RAM: 32GB (minim 8GB)
  - Disk: 200GB SSD (minim 100GB)

Cache Server (Redis):
  - CPU: 2 vCPU
  - RAM: 4GB (minim 2GB)
  - Disk: 20GB (pentru persistence)
```

---

## 2. COMPARATIE PROVIDERI CLOUD

### 2.1 Hetzner Cloud (Germania, Falkenstein) — RECOMANDAT

**Avantaje:**
- Cel mai bun raport pret/performanta din Europa
- Datacenter in Germania (Falkenstein, Nuremberg) — ~20ms latenta catre Romania
- GDPR compliant, ISO 27001
- API matura, Terraform + Ansible support
- Bandwidth generos (20TB inclusiv)
- Floating IP pentru high availability
- LB managedbalancer built-in

**Dezavantaje:**
- Self-managed (nu e fully managed)
- Suport in engleza

**Configuratie OPTIUNEA A — Starter (50-100 utilizatori):**
```
Componenta                    Model           vCPU  RAM   SSD      Pret/luna
App Server                    CCX23           4     16GB  160GB    €24.49
Database Server               CCX13           2     8GB   80GB     €12.49
Redis Cache                   CX22            2     4GB   40GB     €4.49
Load Balancer (LB11)          LB11            -     -     -        €5.49
Volume Backup 100GB           Block Storage   -     -     100GB    €8.00
Floating IP (redundanta)      Floating IP     -     -     -        €3.57
────────────────────────────────────────────────────────────────────────────
TOTAL LUNAR:                                                        €58.53
ANNUAL (cu 10% discount Hetzner):                                  ~€633
```

**Configuratie OPTIUNEA B — Business (200-500 utilizatori):**
```
Componenta                    Cantitate  Model    vCPU  RAM    SSD      Cost/luna
App Servers (HA)              2x         CCX23    4     16GB   160GB    €48.98
Database Server (Primary)     1x         CCX33    8     32GB   240GB    €48.49
Redis Cache                   1x         CX32     4     8GB    80GB     €7.49
Load Balancer (LB11)          1x         LB11     -     -      -        €5.49
Managed DB Backup Volume      1x         100GB    -     -      100GB    €4.40
Floating IPs                  2x         -        -     -      -        €7.14
────────────────────────────────────────────────────────────────────────────
TOTAL LUNAR:                                                             €122.00
ANNUAL (cu discount):                                                   ~€1,320
```

**Configuratie OPTIUNEA C — Enterprise (500+ utilizatori):**
```
Componenta                    Cantitate  Model    vCPU  RAM    SSD      Cost/luna
App Servers (HA)              3x         CCX33    8     32GB   240GB    €145.47
Database Primary              1x         CCX43    16    64GB   360GB    €96.49
Database Replica (standby)    1x         CCX33    8     32GB   240GB    €48.49
Redis Cluster                 2x         CCX13    2     8GB    80GB     €24.98
Load Balancer (LB21)          1x         LB21     -     -      -        €15.49
Volumes + Backups             -          -        -     -      250GB    €20.00
────────────────────────────────────────────────────────────────────────────
TOTAL LUNAR:                                                             €350.92
ANNUAL (cu discount):                                                   ~€3,800
```

---

### 2.2 Cloudify.ro (Romania, Timisoara) — ALTERNATIVA ROMANEASCA

**Avantaje:**
- Datacenter FIZIC in Romania (Timisoara) — latenta <5ms!
- Cel mai ieftin pret din lista
- Suport in limba romana
- Perfect GDPR (data residency in RO)
- Support direct cu echipa romaneasca

**Dezavantaje:**
- Ecosistem mai mic (fara managed services)
- Trebuie administrare manuala completa
- Bandwidth limitat (10TB)

**Configuratie Recomandata:**
```
Componenta              vCPU  RAM    NVMe    Pret/luna
App Server              4     16GB   100GB   €10.00
Database Server         8     32GB   512GB   €20.00
Redis Cache             2     4GB    50GB    €6.00
────────────────────────────────────────────────────────────────
TOTAL LUNAR:                                €36.00
ANNUAL:                                    ~€432
```

*NOTA: Preturile Cloudify.ro sunt extreme de competitive!*

---

### 2.3 OVHcloud (Franta + Germania)

**Avantaje:**
- Bandwidth nelimitat
- GDPR strong, SecNumCloud certification
- Managed PostgreSQL disponibil
- Ansible automation
- Support 24/7

**Dezavantaje:**
- Pret mai inalt
- Latenta mai mare (25-30ms)

**Configuratie:**
```
VPS Comfort (4 vCPU/8GB)           €26.00
VPS Elite (8 vCPU/32GB)            €96.00
Managed PostgreSQL (entry)         €17.00
TOTAL LUNAR:                       ~€80.00
```

---

### 2.4 DigitalOcean (Amsterdam/Frankfurt)

**Avantaje:**
- Managed PostgreSQL built-in
- Managed Redis disponibil
- App Platform cu auto-deploy
- UX excelent (cloud dashboard)
- Community mare

**Dezavantaje:**
- Pret mediu-inalt
- Latenta 30ms+
- Bandwidth limitat (4TB)

**Configuratie:**
```
Droplet 4vCPU/8GB                 $48.00
Managed PostgreSQL (entry)        $15.00
Managed Redis                     $15.00
TOTAL LUNAR:                      ~€72.00
```

---

### 2.5 TABEL COMPARATIV FINAL

| **Criteriu** | **Hetzner** | **Cloudify** | **OVH** | **DigitalOcean** |
|---|---|---|---|---|
| Pret (config similara) | €58/luna | €36/luna | €80/luna | €72/luna |
| Latenta Romania | ~20ms | <5ms | ~25ms | ~30ms |
| Managed PostgreSQL | NU | NU | DA | DA |
| Datacenter Romania | NU | DA | NU | NU |
| GDPR Compliance | DA | DA++ | DA+ | DA |
| Bandwidth Inclus | 20TB | 10TB | Nelimitat | 4TB |
| Ecosystem/Tools | Excelent | Basic | Bun | Excelent |
| Suport Romana | NU | DA | NU | NU |
| Uptime SLA | 99.9% | 99.9% | 99.99% | 99.99% |
| Firewall/DDoS | Builtin | Basic | Builtin | Basic |
| Load Balancer | LB11 (€5.49) | Manual | OVH LB | Included |
| High Availability | Excelent | Manual | Bun | Bun |

---

## 3. RECOMANDARE FINALA

### Varianta 1: BEST VALUE (RECOMANDARE PRIMARA) — Hetzner Cloud

**Ideal pentru:** Majoritatea cazurilor, echipe cu DevOps minim

**Ratiune:**
- Cost-efectiv: ~€58-122/luna vs. €72+ la competitori
- Latenta acceptabila (20ms)
- Ecosystem matur (terraform, ansible, API)
- GDPR compliant
- Scalar ușor la orice size

**Setup Recomandat:** Optiunea B (Business) pentru start
- 2 App Servers (failover automat)
- 1 DB Primary + backup automat
- Load balancer managedintegrat
- ~€122/luna = perfect pentru MVP

---

### Varianta 2: LOWEST LATENCY — Cloudify.ro

**Ideal pentru:** Stricta data residency in Romania, latenta critica

**Ratiune:**
- Datacenter fizic IN Romania (<5ms latenta!)
- Cel mai ieftin (~€36/luna)
- Suport direct in romana
- Perfect daca ai echipa IT interna care poate manage

**Setup Recomandat:** All-in-one inceput
- 1 server powerful (8vCPU/32GB) cu PostgreSQL + Redis
- ~€36/luna
- Scale later cu replication + HA

---

### Varianta 3: FULLY MANAGED — DigitalOcean

**Ideal pentru:** Echipe mici fara DevOps dedicat

**Ratiune:**
- Managed PostgreSQL = nu ai grija de backup/updates
- Managed Redis included
- App Platform cu auto-deploy CI/CD
- UX foarte user-friendly

**Setup Recomandat:** Drop-in replacement
- 1 Droplet 4vCPU/8GB
- Managed PostgreSQL
- Managed Redis
- ~€78/luna (managed included)

---

## 4. ARHITECTURA RECOMANDATA (Hetzner)

### 4.1 Diagrama Sistemului

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare CDN + WAF + DDoS Protection + SSL/TLS           │
│  (FREE tier suficient, sau Cloudflare Pro €20/luna)         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ Hetzner Load        │
         │ Balancer (LB11)     │
         │ Health Checks OK    │
         │ Port 443 + 80       │
         └──────────┬──────────┘
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
   ┌─────────────┐         ┌─────────────┐
   │ App Server  │ <---┬──>│ App Server  │
   │ #1 (CCX23)  │     │   │ #2 (CCX23)  │
   │ Node.js 20  │     │   │ Node.js 20  │
   │ Express API │     │   │ Express API │
   │ Nginx       │     │   │ Nginx       │
   └──────┬──────┘     │   └──────┬──────┘
          │            │          │
          └────────────┼──────────┘
                       │ (Private Network 10.0.1.0/24)
            ┌──────────┴──────────┐
            ▼                     ▼
       ┌──────────────┐    ┌──────────────┐
       │ Redis Cache  │    │ PostgreSQL   │
       │ (CX22)       │    │ Primary DB   │
       │ 4GB RAM      │    │ (CCX13)      │
       │ BullMQ Jobs  │    │ 8GB RAM      │
       │              │    │ 80GB SSD     │
       └──────────────┘    └──────┬───────┘
                                  │
                          ┌───────▼───────┐
                          │ Block Storage │
                          │ 100GB Backup  │
                          │ (Automated)   │
                          └───────────────┘

REDUNDANTA:
- App Servers: Load Balancer detects failures
- Database: Automated daily backups to block storage
- Redis: Persistence enabled (RDB + AOF)
- Floating IP: Quick IP reassignment daca cade server
```

### 4.2 Networking

**Private Network Setup:**
```
Network: 10.0.1.0/24
Gateway: 10.0.1.1

Servers (Static IPs):
- cypher-app-1:    10.0.1.11
- cypher-app-2:    10.0.1.12
- cypher-db:       10.0.1.2
- cypher-redis:    10.0.1.3
- Load Balancer:   Public IP + Private 10.0.1.254
```

**Firewall Rules (hcloud firewall):**
```
INBOUND:
  - SSH (22):         Your IP only (/32)
  - HTTP (80):        0.0.0.0/0 (Cloudflare redirects)
  - HTTPS (443):      0.0.0.0/0 (Main traffic)
  - Prometheus (9090):10.0.0.0/16 (Internal monitoring)

OUTBOUND:
  - All allowed (egress)

INTERNAL (Private Network):
  - All traffic allowed between servers
```

### 4.3 Domain & DNS

**Domain Recommendation:**
- Primary: `erp.ledux.ro` — Frontend principal
- API (optional): `api.erp.ledux.ro` — Backend API
- Monitoring: `grafana.erp.ledux.ro` — Grafana Dashboard
- Status Page: `status.erp.ledux.ro` — Uptime monitoring

**DNS Configuration (Cloudflare):**
```
erp.ledux.ro          A     [Hetzner LB11 Public IP]
api.erp.ledux.ro      CNAME erp.ledux.ro
grafana.erp.ledux.ro  CNAME erp.ledux.ro
*.erp.ledux.ro        CNAME erp.ledux.ro (wildcard)

TXT Record for DMARC/SPF:
v=spf1 include:cloudflare.net ~all
DMARC: v=DMARC1; p=quarantine; rua=mailto:security@ledux.ro
```

**SSL/TLS Configuration:**
- **Option A**: Cloudflare Origin Certificate (gratuit, 15 ani validitate)
  - Issued by: Cloudflare
  - Type: Full (Strict) mode
  - HSTS enabled: max-age=31536000 (1 year)
  
- **Option B**: Let's Encrypt (gratuit, 90 zile)
  - Auto-renew via certbot
  - Supported by Nginx

---

## 5. SETUP PAS CU PAS (Hetzner Cloud)

### 5.1 Prerequisite: Hetzner Account Setup

```bash
# 1. Create Hetzner Cloud account at https://console.hetzner.cloud
# 2. Generate API token (Console > Security > API Tokens)
# 3. Add SSH key (Console > Security > SSH Keys)

# 4. Install hcloud CLI (macOS)
brew install hcloud

# 5. Install Terraform (IaC optional dar recomandat)
brew install terraform

# 6. Create context
hcloud context create cypher-production
# Paste API token when prompted
```

### 5.2 Creare Resurse Hetzner

```bash
#!/bin/bash
# create_infrastructure.sh

API_TOKEN="YOUR_HETZNER_API_TOKEN"
LOCATION="fsn1"  # Falkenstein, Germania
NETWORK_NAME="cypher-net"
FIREWALL_NAME="cypher-fw"

# Set context
hcloud context use cypher-production

# 1. Create Private Network
echo "Creating private network..."
hcloud network create \
  --name "$NETWORK_NAME" \
  --ip-range 10.0.1.0/16

hcloud network add-subnet "$NETWORK_NAME" \
  --type cloud \
  --network-zone eu-central \
  --ip-range 10.0.1.0/24

# 2. Create Firewall
echo "Creating firewall..."
hcloud firewall create --name "$FIREWALL_NAME"

# Add SSH access (schimba YOUR_IP cu IP-ul tau)
hcloud firewall add-rule "$FIREWALL_NAME" \
  --direction in \
  --protocol tcp \
  --port 22 \
  --source-ips YOUR_IP/32

# Add HTTP/HTTPS (public)
hcloud firewall add-rule "$FIREWALL_NAME" \
  --direction in \
  --protocol tcp \
  --port 80 \
  --source-ips 0.0.0.0/0

hcloud firewall add-rule "$FIREWALL_NAME" \
  --direction in \
  --protocol tcp \
  --port 443 \
  --source-ips 0.0.0.0/0

# 3. Create App Servers
echo "Creating app servers..."
hcloud server create \
  --name cypher-app-1 \
  --type ccx23 \
  --image ubuntu-22.04 \
  --location "$LOCATION" \
  --ssh-key default \
  --network "$NETWORK_NAME" \
  --firewall "$FIREWALL_NAME" \
  --automount=false

hcloud server create \
  --name cypher-app-2 \
  --type ccx23 \
  --image ubuntu-22.04 \
  --location "$LOCATION" \
  --ssh-key default \
  --network "$NETWORK_NAME" \
  --firewall "$FIREWALL_NAME" \
  --automount=false

# 4. Create Database Server
echo "Creating database server..."
hcloud server create \
  --name cypher-db \
  --type ccx13 \
  --image ubuntu-22.04 \
  --location "$LOCATION" \
  --ssh-key default \
  --network "$NETWORK_NAME" \
  --firewall "$FIREWALL_NAME" \
  --automount=false

# 5. Create Redis Server
echo "Creating redis server..."
hcloud server create \
  --name cypher-redis \
  --type cx22 \
  --image ubuntu-22.04 \
  --location "$LOCATION" \
  --ssh-key default \
  --network "$NETWORK_NAME" \
  --firewall "$FIREWALL_NAME" \
  --automount=false

# 6. Create Block Storage for backups
echo "Creating backup volume..."
hcloud volume create \
  --name cypher-backup \
  --size 100 \
  --server cypher-db \
  --location "$LOCATION" \
  --format ext4

# 7. Create Load Balancer
echo "Creating load balancer..."
hcloud load-balancer create \
  --name cypher-lb \
  --type lb11 \
  --location "$LOCATION" \
  --network-zone eu-central

# 8. Add servers to load balancer
echo "Configuring load balancer..."
LB_ID=$(hcloud load-balancer list -o json | jq -r '.[] | select(.name=="cypher-lb") | .id')

hcloud load-balancer add-target "$LB_ID" \
  --type server \
  --server cypher-app-1

hcloud load-balancer add-target "$LB_ID" \
  --type server \
  --server cypher-app-2

# 9. Create Floating IP for failover
echo "Creating floating IP..."
hcloud floating-ip create \
  --name cypher-ip \
  --type ipv4 \
  --home-location "$LOCATION"

echo "✓ Infrastructure created successfully!"
echo "Get IPs: hcloud server list -o json | jq '.[] | {name, public_net}'  "
```

### 5.3 Configurare PostgreSQL

```bash
#!/bin/bash
# setup_postgres.sh — ruleaza pe cypher-db server

set -e

echo "Installing PostgreSQL 15..."
sudo apt-get update
sudo apt-get install -y postgresql-15 postgresql-contrib-15 postgresql-15-pg-trgm

# Configurare performance tuning
sudo tee /etc/postgresql/15/main/conf.d/cypher-performance.conf > /dev/null << 'EOF'
# ==============================================
# CYPHER ERP — PostgreSQL Performance Tuning
# ==============================================

# Memory Configuration (adjust based on server RAM)
shared_buffers = 2GB                    # 25% of RAM
effective_cache_size = 6GB              # 75% of RAM
work_mem = 32MB                         # RAM per operation
maintenance_work_mem = 512MB            # Memory for VACUUM, CREATE INDEX

# Connections
max_connections = 200                   # Max concurrent connections
max_prepared_transactions = 100

# Network
listen_addresses = '10.0.1.*'          # Accept on private network only
port = 5432

# WAL (Write-Ahead Logging) — needed for backup/replication
wal_level = replica                     # Enable archiving
max_wal_senders = 5                     # Max replication connections
wal_keep_size = 1GB                     # Keep 1GB of WAL
max_slot_wal_keep_size = 2GB

# Logging
log_min_duration_statement = 1000       # Log queries > 1 second
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0
log_statement = 'mod'                   # Log DDL + DML
log_min_error_statement = 'LOG'

# Query Planning
random_page_cost = 1.1                  # SSD optimization
effective_io_concurrency = 200          # For SSD
jit = on                                # JIT compilation for complex queries

# Checkpoint
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9      # Spread checkpoint over 90% of interval

# Auto VACUUM
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 10s

# Indexes
maintenance_work_mem = 512MB
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql

# Verify running
sudo systemctl status postgresql

# Check listening
sudo netstat -tlnp | grep 5432
```

Create database user & database:
```bash
sudo -u postgres psql << 'PGEOF'
-- Create superuser for backups
CREATE USER cypher_admin WITH PASSWORD 'LONG_RANDOM_PASSWORD_MIN_32_CHARS';
ALTER USER cypher_admin SUPERUSER;

-- Create application user (limited permissions)
CREATE USER cypher WITH PASSWORD 'APP_PASSWORD_MIN_32_CHARS' CREATEDB;

-- Create database
CREATE DATABASE cypher_erp OWNER cypher;

-- Create extensions
\c cypher_erp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";          -- Text search
CREATE EXTENSION IF NOT EXISTS "hstore";           -- Key-value storage
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- Encryption functions

-- Grant permissions
GRANT CONNECT ON DATABASE cypher_erp TO cypher;
GRANT USAGE ON SCHEMA public TO cypher;
GRANT CREATE ON SCHEMA public TO cypher;

-- Future tables — grant automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cypher;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cypher;
PGEOF
```

Firewall configuration (accept conexiuni doar din private network):
```bash
# /etc/postgresql/15/main/pg_hba.conf
echo "# Accept connections only from private network" | sudo tee -a /etc/postgresql/15/main/pg_hba.conf
echo "host cypher_erp cypher 10.0.1.0/24 scram-sha-256" | sudo tee -a /etc/postgresql/15/main/pg_hba.conf

sudo systemctl restart postgresql
```

---

### 5.4 Configurare Redis

```bash
#!/bin/bash
# setup_redis.sh — ruleaza pe cypher-redis server

set -e

echo "Installing Redis 7..."
sudo apt-get update
sudo apt-get install -y redis-server redis-tools

# Stop default service temporarily
sudo systemctl stop redis-server

# Backup original config
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup

# Configure Redis
sudo tee /etc/redis/redis.conf > /dev/null << 'EOF'
# ================================
# CYPHER ERP — Redis Configuration
# ================================

# Network
bind 10.0.1.3                          # Listen on private IP only
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Security
requirepass REDIS_PASSWORD_MIN_32_CHARS  # Strong password!

# Memory Management
maxmemory 2gb                           # Max 2GB (adjust to server)
maxmemory-policy allkeys-lru            # Evict LRU when full

# Persistence (RDB + AOF)
save 900 1                              # Save after 900s if 1+ change
save 300 10                             # Save after 300s if 10+ changes
save 60 10000                           # Save after 60s if 10k+ changes

# AOF (Append-Only File) — more reliable
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec                    # Fsync every second (balance speed/safety)
no-appendfsync-on-rewrite no

# Clients
maxclients 10000
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# Slowlog (for monitoring)
slowlog-log-slower-than 10000           # Log commands > 10ms
slowlog-max-len 128

# Lazyfree (faster eviction)
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
EOF

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify
redis-cli -h 10.0.1.3 ping              # Should return PONG

echo "✓ Redis configured successfully"
```

---

### 5.5 Deploy Aplicatie Node.js

```bash
#!/bin/bash
# deploy_app.sh — ruleaza pe cypher-app-1 si cypher-app-2

set -e

APP_USER="cypher"
APP_HOME="/opt/cypher"
APP_REPO="git@github.com:ledux/cypher-erp.git"
NODE_VERSION="20"

echo "Setting up app environment..."

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt-get install -y nodejs npm

# Install nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Create app user
sudo useradd -m -s /bin/bash "$APP_USER" || true

# Clone repository
sudo mkdir -p "$APP_HOME"
sudo chown "$APP_USER:$APP_USER" "$APP_HOME"

cd "$APP_HOME"
sudo -u "$APP_USER" git clone "$APP_REPO" .
sudo -u "$APP_USER" git checkout main

# Install dependencies
cd "$APP_HOME"
sudo -u "$APP_USER" npm ci --production  # Use package-lock.json

# Build frontend
cd "$APP_HOME/frontend"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build       # Creates dist/ folder

# Create environment file
sudo tee "$APP_HOME/.env" > /dev/null << 'EOF'
NODE_ENV=production
PORT=4000

# Database
DB_HOST=10.0.1.2
DB_PORT=5432
DB_NAME=cypher_erp
DB_USER=cypher
DB_PASSWORD=APP_PASSWORD_MIN_32_CHARS
DB_POOL_MIN=5
DB_POOL_MAX=20

# Redis
REDIS_HOST=10.0.1.3
REDIS_PORT=6379
REDIS_PASSWORD=REDIS_PASSWORD_MIN_32_CHARS
REDIS_DB=0

# JWT
JWT_SECRET=JWT_SECRET_MIN_256BIT_RANDOM
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=REFRESH_SECRET_MIN_256BIT
JWT_REFRESH_EXPIRES_IN=7d

# API Keys (SmartBill integration)
SMARTBILL_API_KEY=YOUR_SMARTBILL_KEY
SMARTBILL_EMAIL=api@ledux.ro
SMARTBILL_CIF=RO1234567

# WooCommerce integration (optional)
WOO_CONSUMER_KEY=your_woo_key
WOO_CONSUMER_SECRET=your_woo_secret
WOO_STORE_URL=https://ledux.ro

# Emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@ledux.ro
SMTP_PASSWORD=APP_PASSWORD
SMTP_FROM=noreply@ledux.ro

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Features
FEATURES_MFA_ENABLED=true
FEATURES_API_RATE_LIMIT=100
EOF

sudo chown "$APP_USER:$APP_USER" "$APP_HOME/.env"
sudo chmod 600 "$APP_HOME/.env"

# Run migrations
cd "$APP_HOME"
sudo -u "$APP_USER" npm run migration:run

# Setup PM2 process manager
sudo npm install -g pm2

sudo -u "$APP_USER" pm2 start dist/src/server.js \
  --name cypher-api \
  --instances max \
  --exec-mode cluster \
  --merge-logs

sudo -u "$APP_USER" pm2 startup
sudo -u "$APP_USER" pm2 save

echo "✓ Application deployed successfully"
```

---

### 5.6 Nginx Reverse Proxy + Frontend

```bash
#!/bin/bash
# setup_nginx.sh

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/cypher > /dev/null << 'NGINX_CONF'
# HTTP — Redirect to HTTPS
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    
    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS — Main application
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name erp.ledux.ro;

    # SSL Certificates (Cloudflare Origin Certificate)
    ssl_certificate /etc/ssl/certs/cloudflare-origin.pem;
    ssl_certificate_key /etc/ssl/private/cloudflare-origin.key;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend static files
    root /opt/cypher/frontend/dist;
    index index.html index.htm;

    # === API ROUTES ===
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Request-ID $request_id;
        
        # Timeouts (important for ERP long-running operations)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
        
        # Don't cache API responses
        proxy_cache_bypass $http_upgrade;
        proxy_no_cache $http_upgrade;
    }

    # === HEALTH CHECK ===
    location /health {
        proxy_pass http://127.0.0.1:4000;
        access_log off;
    }

    # === METRICS (Prometheus) ===
    location /metrics {
        proxy_pass http://127.0.0.1:4000;
        # Restrict to internal IPs only
        allow 10.0.0.0/16;
        allow 127.0.0.1;
        deny all;
    }

    # === STATIC ASSETS ===
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # === SPA FALLBACK ===
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # === SECURITY HEADERS ===
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # === GZIP COMPRESSION ===
    gzip on;
    gzip_types text/plain application/json application/javascript text/css text/xml;
    gzip_min_length 1000;
    gzip_vary on;

    # === LOGGING ===
    access_log /var/log/nginx/cypher-access.log combined buffer=32k flush=5s;
    error_log /var/log/nginx/cypher-error.log warn;
}
NGINX_CONF

# Enable site
sudo ln -sf /etc/nginx/sites-available/cypher /etc/nginx/sites-enabled/cypher
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

echo "✓ Nginx configured successfully"
```

---

### 5.7 Backup Automat

```bash
#!/bin/bash
# setup_backups.sh — ruleaza pe cypher-db

set -e

# Setup backup directory
sudo mkdir -p /mnt/backup
sudo chown postgres:postgres /mnt/backup
sudo chmod 700 /mnt/backup

# Create backup script
sudo tee /usr/local/bin/backup-cypher.sh > /dev/null << 'BACKUP_SCRIPT'
#!/bin/bash

BACKUP_DIR="/mnt/backup"
DB_NAME="cypher_erp"
DB_USER="cypher_admin"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup
echo "Starting PostgreSQL backup..."
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/cypher_db_${TIMESTAMP}.sql.gz"

# Redis backup
echo "Starting Redis backup..."
redis-cli -h 10.0.1.3 BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis_${TIMESTAMP}.rdb"

# Cleanup old backups (older than 30 days)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: $(ls -lh $BACKUP_DIR | tail -5)"
BACKUP_SCRIPT

sudo chmod +x /usr/local/bin/backup-cypher.sh

# Setup cron job (daily at 3:00 AM)
sudo tee /etc/cron.d/cypher-backup > /dev/null << 'CRON'
# Cypher ERP daily backups
0 3 * * * root /usr/local/bin/backup-cypher.sh >> /var/log/cypher-backup.log 2>&1
CRON

echo "✓ Automated backups configured (daily at 3:00 AM)"
```

---

### 5.8 Monitoring & Alerting

```bash
#!/bin/bash
# setup_monitoring.sh

# Install Prometheus + Grafana (docker-compose)
sudo mkdir -p /opt/monitoring
cd /opt/monitoring

# Docker Compose file
sudo tee docker-compose.yml > /dev/null << 'DOCKER'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
    restart: unless-stopped
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: CHANGE_ME_STRONG_PASSWORD
      GF_INSTALL_PLUGINS: grafana-piechart-panel
    volumes:
      - grafana-data:/var/lib/grafana
    restart: unless-stopped
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped
    networks:
      - monitoring

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring:
DOCKER

# Prometheus configuration
sudo tee prometheus.yml > /dev/null << 'PROMETHEUS'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files: []

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'cypher-app'
    static_configs:
      - targets: ['10.0.1.11:4000']
    metrics_path: '/metrics'

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['10.0.1.2:9187']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['10.0.1.3:9121']
PROMETHEUS

# Start services
docker-compose up -d

echo "✓ Monitoring stack started"
echo "  Prometheus: http://localhost:9090"
echo "  Grafana: http://localhost:3001"
```

---

## 6. SECURITATE PRODUCTIE

### 6.1 Security Checklist

```
NETWORK SECURITY:
  ☐ Firewall rules: SSH restricted, 80/443 public only
  ☐ Private network: All internal traffic on 10.0.1.0/24
  ☐ No public IPs on DB/Redis servers
  ☐ DDoS protection: Cloudflare active
  ☐ WAF rules: Cloudflare OWASP ModSecurity enabled

SSH SECURITY:
  ☐ Key-only authentication (disable password)
  ☐ SSH port: Use non-standard port (optional)
  ☐ SSH root disabled
  ☐ SSH keys backed up securely
  ☐ ssh-agent for key management

DATABASE SECURITY:
  ☐ PostgreSQL: listen only on 10.0.1.2 (private)
  ☐ PostgreSQL: Strong passwords (min 32 chars)
  ☐ PostgreSQL: Limited user permissions
  ☐ PostgreSQL: Connection SSL (optional)
  ☐ pg_hba.conf: scram-sha-256 only
  ☐ Backups: Encrypted + tested restore

REDIS SECURITY:
  ☐ Redis: requirepass set (min 32 chars)
  ☐ Redis: bind 10.0.1.3 only (private)
  ☐ Redis: Persistence enabled
  ☐ Redis: ACL configured (6.0+ optional)
  ☐ Connection firewall: 10.0.1.0/24 only

APPLICATION SECURITY:
  ☐ .env file: 600 permissions, not in git
  ☐ JWT_SECRET: 256-bit random (openssl rand -hex 128)
  ☐ CORS: Only erp.ledux.ro
  ☐ Helmet.js: CSP, HSTS, X-Frame enabled
  ☐ Rate limiting: 100 req/min per IP
  ☐ Input validation: All user inputs
  ☐ SQL injection: Use parameterized queries
  ☐ XSS protection: Sanitize output

TLS/SSL:
  ☐ Certificate: Cloudflare Origin + auto-renew
  ☐ HSTS: max-age=31536000; includeSubDomains
  ☐ TLS 1.2+: Minimum version
  ☐ Certificate monitoring: Alerts 30 days before expiry

MONITORING & LOGGING:
  ☐ Application logs: JSON format, timestamped
  ☐ Access logs: Nginx + rotation (7 days)
  ☐ Error logs: Separate, monitored
  ☐ Audit logs: User actions, data access
  ☐ Centralized logging: ELK stack (optional)
  ☐ Security logs: Failed logins, config changes

COMPLIANCE:
  ☐ GDPR: Data processing agreement signed
  ☐ GDPR: Privacy policy updated
  ☐ GDPR: DPA/DPIA completed
  ☐ GDPR: Right to erasure implemented
  ☐ GDPR: Right to portability implemented
  ☐ Backups: Encrypted at rest (optional)
  ☐ Encryption: TLS in transit (required)

OPERATIONS:
  ☐ Updates: Unattended-upgrades active
  ☐ Intrusion detection: fail2ban configured
  ☐ File integrity: aide or tripwire (optional)
  ☐ Kernel hardening: sysctl security params
  ☐ Kernel patches: Latest LTS version
  ☐ Regular updates: Security patches bi-weekly

DISASTER RECOVERY:
  ☐ RTO: 1 hour (recovery time)
  ☐ RPO: 24 hours (data loss acceptable)
  ☐ Backups: Daily, 30-day retention
  ☐ Backup testing: Restore tested monthly
  ☐ Failover: Floating IP ready
  ☐ Documentation: Runbooks for incidents
```

### 6.2 Example Security Configuration

```bash
#!/bin/bash
# security_hardening.sh

# 1. Disable SSH password authentication
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# 2. Setup fail2ban (brute force protection)
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban

sudo tee /etc/fail2ban/jail.local > /dev/null << 'FAIL2BAN'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true
FAIL2BAN

sudo systemctl restart fail2ban

# 3. Configure UFW firewall
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                   # SSH
sudo ufw allow 80/tcp                   # HTTP
sudo ufw allow 443/tcp                  # HTTPS
sudo ufw enable

# 4. Setup unattended upgrades
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 5. Kernel hardening (sysctl)
sudo tee -a /etc/sysctl.d/99-hardening.conf > /dev/null << 'SYSCTL'
# IP forwarding
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048

# Ignore ICMP redirects
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Restrict ICMP ping responses
net.ipv4.icmp_echo_ignore_all = 1

# Log suspicious packets
net.ipv4.conf.all.log_martians = 1
SYSCTL

sudo sysctl -p /etc/sysctl.d/99-hardening.conf

echo "✓ Security hardening completed"
```

---

## 7. COSTURI LUNARE ESTIMATE

### Varianta STARTER — Hetzner (RECOMANDARE)

```
╔════════════════════════════════════════════════════════════════╗
║             COSTUL LUNAR — CYPHER ERP (Hetzner)                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                  ║
║ INFRASTRUCTURE:                                                  ║
║   • App Server CCX23 (4vCPU/16GB/160SSD)     €24.49/luna       ║
║   • DB Server CCX13 (2vCPU/8GB/80SSD)        €12.49/luna       ║
║   • Redis Cache CX22 (2vCPU/4GB)              €4.49/luna        ║
║   • Load Balancer LB11                        €5.49/luna        ║
║   • Block Storage Backup 100GB                €8.00/luna        ║
║   • Floating IP (redundanta)                  €3.57/luna        ║
║                                              ─────────────────  ║
║   Subtotal Infrastructure (Hetzner):        €58.53/luna        ║
║                                                                  ║
║ SERVICES:                                                        ║
║   • Cloudflare Pro (CDN + WAF)               €20.00/luna        ║
║   • Domain .ro (annual, prorated)             €0.83/luna        ║
║   • Email (Gmail Business, 1 user)            ~€6.00/luna       ║
║                                              ─────────────────  ║
║   Subtotal Services:                         €26.83/luna        ║
║                                                                  ║
║ MONITORING (optional):                                           ║
║   • Sentry (error tracking)                  €29.00/luna        ║
║   • DataDog (APM)                           $15+/luna           ║
║   • Self-hosted Prometheus/Grafana           €0/luna            ║
║                                              ─────────────────  ║
║   Subtotal Monitoring:                        €0-30/luna        ║
║                                                                  ║
╠════════════════════════════════════════════════════════════════╣
║  TOTAL ESTIMAT (fara monitoring):             ~€85/luna        ║
║  TOTAL CU Sentry:                             ~€115/luna       ║
║  ANNUAL (cu 10% discount Hetzner yearly):     ~€920-1,200      ║
║  ANNUAL (fara monitoring):                    ~€1,020           ║
╚════════════════════════════════════════════════════════════════╝
```

### Varianta ULTRA-IEFTINA — Cloudify.ro

```
╔════════════════════════════════════════════════════════════════╗
║           COSTUL LUNAR — CYPHER ERP (Cloudify.ro)              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                  ║
║ INFRASTRUCTURE (Cloudify.ro):                                   ║
║   • All-in-one Server (8vCPU/32GB/512SSD)   €20.00/luna        ║
║     ├─ PostgreSQL + Redis + App (same)                          ║
║     └─ Geographic redundancy: Manual setup                      ║
║                                              ─────────────────  ║
║   Subtotal Infrastructure:                  €20.00/luna        ║
║                                                                  ║
║ SERVICES:                                                        ║
║   • Cloudflare Free (CDN basic)              €0.00/luna         ║
║   • Domain .ro                               €0.83/luna         ║
║                                              ─────────────────  ║
║   Subtotal Services:                         €0.83/luna         ║
║                                                                  ║
╠════════════════════════════════════════════════════════════════╣
║  TOTAL ESTIMAT:                              ~€21/luna          ║
║  ANNUAL:                                      ~€250              ║
║  NOTE: Suport in romana inclus!                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Varianta FULLY MANAGED — DigitalOcean

```
╔════════════════════════════════════════════════════════════════╗
║          COSTUL LUNAR — CYPHER ERP (DigitalOcean)              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                  ║
║ INFRASTRUCTURE:                                                  ║
║   • Droplet 4vCPU/8GB (App + Frontend)       $48.00/luna        ║
║   • Managed PostgreSQL Standard              $15.00/luna        ║
║   • Managed Redis Standard                   $15.00/luna        ║
║   • Spaces Storage 250GB (backups)            $5.00/luna        ║
║                                              ─────────────────  ║
║   Subtotal Infrastructure (in USD):          $83.00/luna        ║
║   = ~€76/luna (la curs 1 USD = 0.92 EUR)                        ║
║                                                                  ║
║ SERVICES:                                                        ║
║   • Domain .ro                               €0.83/luna         ║
║   • Email                                    €6.00/luna         ║
║                                              ─────────────────  ║
║   Subtotal Services:                         €6.83/luna         ║
║                                                                  ║
╠════════════════════════════════════════════════════════════════╣
║  TOTAL ESTIMAT:                              ~€83/luna          ║
║  ANNUAL:                                      ~€1,000            ║
║  NOTE: Managed services = minimal DevOps                        ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 8. ROADMAP IMPLEMENTARE (3 LUNI)

### Faza 1: Foundation (Saptamana 1-2)

```
□ Hetzner account creation + API token
□ Create infrastructure (Terraform script)
□ Install + configure PostgreSQL
□ Install + configure Redis
□ Setup SSL/TLS certificates
□ Basic security hardening
□ Time investment: 16-24 ore
```

### Faza 2: Application (Saptamana 2-3)

```
□ Deploy Node.js backend (PM2)
□ Setup Nginx reverse proxy
□ Deploy frontend (Vite build)
□ Configure environment variables
□ Database migrations + test
□ Health checks + monitoring basic
□ Time investment: 12-16 ore
```

### Faza 3: Operations (Saptamana 3-4)

```
□ Automated backups setup
□ Monitoring stack (Prometheus + Grafana)
□ Log aggregation (ELK optional)
□ CI/CD pipeline (GitHub Actions)
□ Disaster recovery testing
□ Security audit + penetration testing
□ Time investment: 20-32 ore
```

### Faza 4: Production (Saptamana 4+)

```
□ Load testing (50-200 users)
□ Performance optimization
□ Failover testing
□ Documentation finalization
□ Team training
□ Launch!
□ Time investment: 16-24 ore
```

---

## 9. CONTACT & SUPORT

**DevOps Team Ledux:**
- Email: devops@ledux.ro
- Slack: #infrastructure
- On-call: +40 700 XXX XXX

**SLA Support Response Times:**
- Critical (downtime): 30 minutes
- High (degraded): 2 hours
- Medium (performance): 8 hours
- Low (feature request): 48 hours

---

**Document Version:** 2.0
**Last Updated:** Februarie 2026
**Next Review:** Martie 2026

