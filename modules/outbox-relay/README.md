# Outbox Relay Service

A production-ready outbox pattern relay service for Cypher ERP that reads events from a PostgreSQL outbox table and publishes them to RabbitMQ.

## Features

- **Batch Processing**: Configurable batch size with concurrent processing support
- **Publisher Confirms**: Reliable message delivery with RabbitMQ publisher confirms
- **Restart-Safe**: Idempotent processing with last published event tracking
- **Circuit Breaker**: Protection against cascading failures with configurable thresholds
- **Backoff Strategy**: Exponential backoff with jitter for retries
- **Graceful Shutdown**: Proper cleanup and in-flight batch completion
- **Health Checks**: Kubernetes-ready liveness, readiness, and startup probes
- **Prometheus Metrics**: Comprehensive metrics for monitoring and observability
- **Structured Logging**: Correlation ID propagation for distributed tracing

## Architecture Overview

```
┌─────────────┐
│   Postgres  │ (outbox_events table)
│   Database  │
└──────┬──────┘
       │
       │ 1. Fetch pending events
       │    (FOR UPDATE SKIP LOCKED)
       ▼
┌─────────────────────────────────────┐
│      Outbox Relay Service           │
│  ┌─────────────────────────────┐   │
│  │   OutboxRepository          │   │
│  │   - Fetch pending events    │   │
│  │   - Mark processing         │   │
│  │   - Mark published          │   │
│  │   - Mark failed             │   │
│  └──────────┬──────────────────┘   │
│             ▼                       │
│  ┌─────────────────────────────┐   │
│  │   OutboxProcessor           │   │
│  │   - Batch processing        │   │
│  │   - Retry logic             │   │
│  │   - Error handling          │   │
│  └──────────┬──────────────────┘   │
│             ▼                       │
│  ┌─────────────────────────────┐   │
│  │   RabbitMQPublisher         │   │
│  │   - Connection management   │   │
│  │   - Publisher confirms      │   │
│  │   - Circuit breaker         │   │
│  └──────────┬──────────────────┘   │
└─────────────┼─────────────────────┘
              │
              │ 2. Publish events
              ▼
      ┌───────────────┐
      │   RabbitMQ    │
      │  (Exchanges,  │
      │   Queues)     │
      └───────────────┘
```

## Installation

### From Source

```bash
cd /opt/cypher-erp/modules/outbox-relay
npm install
npm run build
```

### Using Docker

```bash
docker build -t cypher-erp/outbox-relay:latest .
```

## Configuration

Configuration is done via environment variables. See `src/Config.ts` for all available options.

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `cypher_erp` |
| `DB_USER` | Database user | `cypher_user` |
| `DB_PASSWORD` | Database password | `cypher_secret` |
| `DB_SSL` | Use SSL connection | `false` |

### RabbitMQ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `RABBITMQ_URL` | Connection URL | `amqp://localhost:5672/` |
| `RABBITMQ_HOST` | RabbitMQ host | `localhost` |
| `RABBITMQ_PORT` | RabbitMQ port | `5672` |
| `RABBITMQ_USER` | Username | - |
| `RABBITMQ_PASSWORD` | Password | - |
| `RABBITMQ_VHOST` | Virtual host | `/` |
| `RABBITMQ_PUBLISHER_CONFIRMS` | Enable publisher confirms | `true` |
| `RABBITMQ_MANDATORY` | Mandatory publish flag | `true` |

### Batch Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OUTBOX_BATCH_SIZE` | Batch size | `100` |
| `OUTBOX_BATCH_INTERVAL_MS` | Processing interval | `5000` |
| `OUTBOX_BATCH_MAX_WAIT_MS` | Maximum wait time | `60000` |

### Retry Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OUTBOX_RETRY_MAX_ATTEMPTS` | Maximum retry attempts | `3` |
| `OUTBOX_RETRY_INITIAL_DELAY_MS` | Initial retry delay | `1000` |
| `OUTBOX_RETRY_MAX_DELAY_MS` | Maximum retry delay | `60000` |
| `OUTBOX_RETRY_BACKOFF_MULTIPLIER` | Backoff multiplier | `2` |
| `OUTBOX_RETRY_JITTER` | Enable jitter | `true` |

### Circuit Breaker Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CIRCUIT_BREAKER_ENABLED` | Enable circuit breaker | `true` |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Failure threshold | `5` |
| `CIRCUIT_BREAKER_SUCCESS_THRESHOLD` | Success threshold | `2` |
| `CIRCUIT_BREAKER_TIMEOUT_MS` | Timeout before half-open | `30000` |

### Health Check Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `HEALTH_CHECK_ENABLED` | Enable health check server | `true` |
| `HEALTH_CHECK_PORT` | Health check port | `9090` |
| `HEALTH_CHECK_PATH` | Health check path | `/health` |
| `HEALTH_CHECK_READINESS_PATH` | Readiness probe path | `/ready` |
| `HEALTH_CHECK_LIVENESS_PATH` | Liveness probe path | `/live` |
| `HEALTH_CHECK_STARTUP_PATH` | Startup probe path | `/startup` |

### Metrics Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `METRICS_ENABLED` | Enable metrics collection | `true` |
| `METRICS_PORT` | Metrics port | `9091` |
| `METRICS_PATH` | Metrics path | `/metrics` |
| `METRICS_PUSHGATEWAY_URL` | Pushgateway URL | - |

## Usage

### CLI Mode

#### Start Continuous Mode

```bash
npm start
# Or
node dist/index.js start
```

#### Process Single Batch

```bash
node dist/index.js process --batch-size 50
```

#### Show Statistics

```bash
node dist/index.js stats --json
```

#### Reset Circuit Breaker

```bash
node dist/index.js reset-cb
```

#### Validate Configuration

```bash
node dist/index.js validate-config
```

### Programmatic Usage

```typescript
import {
  OutboxRelay,
  OutboxRepository,
  RabbitMQPublisher,
  OutboxMetrics,
  OutboxLogger,
} from '@cypher-erp/outbox-relay';

// Create logger
const logger = new OutboxLogger();

// Create components
const repository = new OutboxRepository();
const publisher = new RabbitMQPublisher();
const metrics = new OutboxMetrics({ enabled: true }, logger);

// Create relay
const relay = new OutboxRelay(
  { processOnStartup: true },
  logger,
  metrics
);

// Initialize and start
await relay.initialize();
await relay.start();

// Process manually if needed
const result = await relay.processOnce();

// Get statistics
const stats = relay.getStatistics();

// Graceful shutdown
await relay.stop();
```

## Database Schema

The service expects the following tables to exist in PostgreSQL:

### outbox_events

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `event_id` | UUID | Unique event identifier |
| `event_type` | VARCHAR | Event type |
| `event_version` | VARCHAR | Event version |
| `event_domain` | ENUM | Event domain |
| `source_service` | VARCHAR | Source service |
| `payload` | JSONB | Event payload |
| `status` | ENUM | Event status |
| `attempts` | INTEGER | Retry attempts |
| `priority` | ENUM | Event priority |
| `exchange` | VARCHAR | RabbitMQ exchange |
| `routing_key` | VARCHAR | RabbitMQ routing key |
| `occurred_at` | TIMESTAMPTZ | Event timestamp |
| `published_at` | TIMESTAMPTZ | Published timestamp |

See `/opt/cypher-erp/db/migrations/0005-outbox-events.sql` for the complete schema.

## Health Check Endpoints

| Endpoint | Description | Kubernetes Probe |
|----------|-------------|------------------|
| `GET /health` | General health check | - |
| `GET /health/detailed` | Detailed health check with components | - |
| `GET /ready` | Readiness probe | `readinessProbe` |
| `GET /live` | Liveness probe | `livenessProbe` |
| `GET /startup` | Startup probe | `startupProbe` |
| `GET /stats` | Processing statistics | - |
| `GET /metrics` | Prometheus metrics | - |

### Example Responses

#### Health Check
```json
{
  "status": "pass",
  "timestamp": "2026-02-13T12:00:00.000Z",
  "uptime": 3600000
}
```

#### Detailed Health Check
```json
{
  "status": "pass",
  "timestamp": "2026-02-13T12:00:00.000Z",
  "uptime": 3600000,
  "checks": {
    "postgres": {
      "status": "pass",
      "componentId": "postgres",
      "componentType": "database",
      "time": "2026-02-13T12:00:00.000Z",
      "output": "OK"
    },
    "rabbitmq": {
      "status": "pass",
      "componentId": "rabbitmq",
      "componentType": "message_queue",
      "time": "2026-02-13T12:00:00.000Z",
      "output": "OK"
    },
    "outboxRelay": {
      "status": "pass",
      "componentId": "outboxRelay",
      "componentType": "service",
      "time": "2026-02-13T12:00:00.000Z",
      "output": "OK"
    }
  }
}
```

## Prometheus Metrics

The service exports the following metrics:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `outbox_events_published_total` | Counter | event_type, event_domain, exchange, routing_key | Total events published |
| `outbox_events_failed_total` | Counter | event_type, event_domain, error_type | Total events failed |
| `outbox_events_retried_total` | Counter | event_type, event_domain, attempt | Total retries |
| `outbox_events_discarded_total` | Counter | event_type, event_domain, reason | Total events discarded |
| `outbox_batch_processing_duration_seconds` | Histogram | - | Batch processing duration |
| `outbox_event_processing_duration_seconds` | Histogram | event_type, event_domain | Event processing duration |
| `outbox_postgres_connection_status` | Gauge | - | Postgres connection (1=up, 0=down) |
| `outbox_rabbitmq_connection_status` | Gauge | - | RabbitMQ connection (1=up, 0=down) |
| `outbox_circuit_breaker_state` | Gauge | component | Circuit breaker state |
| `outbox_queue_depth` | Gauge | status | Queue depth |

### Grafana Dashboard

A sample Grafana dashboard is included in the `grafana/dashboards` directory.

## Deployment Guide

### Docker Compose

```bash
docker-compose up -d
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: outbox-relay
spec:
  replicas: 1
  selector:
    matchLabels:
      app: outbox-relay
  template:
    metadata:
      labels:
        app: outbox-relay
    spec:
      containers:
      - name: outbox-relay
        image: cypher-erp/outbox-relay:latest
        ports:
        - containerPort: 9090
        - containerPort: 9091
        env:
        - name: DB_HOST
          value: "postgres"
        - name: RABBITMQ_URL
          value: "amqp://rabbitmq:5672/"
        livenessProbe:
          httpGet:
            path: /live
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 9090
          initialDelaySeconds: 10
          periodSeconds: 10
        startupProbe:
          httpGet:
            path: /startup
            port: 9090
          initialDelaySeconds: 0
          periodSeconds: 10
          failureThreshold: 12
```

## Monitoring Guide

### Key Metrics to Monitor

1. **outbox_events_published_total**: Should be increasing over time
2. **outbox_events_failed_total**: Should remain low or zero
3. **outbox_queue_depth**: Indicates backlog size
4. **outbox_batch_processing_duration_seconds**: Should remain stable
5. **outbox_postgres_connection_status**: Should always be 1
6. **outbox_rabbitmq_connection_status**: Should always be 1
7. **outbox_circuit_breaker_state**: 0=closed (good), 1=open (bad)

### Alerts

Example Prometheus alert rules:

```yaml
groups:
- name: outbox-relay
  rules:
  - alert: HighFailureRate
    expr: rate(outbox_events_failed_total[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: High event failure rate

  - alert: CircuitBreakerOpen
    expr: outbox_circuit_breaker_state{component="rabbitmq"} == 1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: RabbitMQ circuit breaker is open

  - alert: QueueBacklog
    expr: outbox_queue_depth{status="pending"} > 1000
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: Large event backlog detected
```

## Troubleshooting

### Events Not Being Published

1. Check service logs:
   ```bash
   docker logs outbox-relay-service
   ```

2. Verify database connection:
   ```bash
   curl http://localhost:9090/health/detailed
   ```

3. Check queue depth:
   ```bash
   curl http://localhost:9091/metrics | grep outbox_queue_depth
   ```

### Circuit Breaker Open

The circuit breaker opens when consecutive failures exceed the threshold.

1. Check circuit breaker state:
   ```bash
   curl http://localhost:9091/metrics | grep circuit_breaker_state
   ```

2. Reset the circuit breaker:
   ```bash
   docker exec outbox-relay-service node dist/index.js reset-cb
   ```

3. Check RabbitMQ connection:
   ```bash
   docker exec outbox-relay-service rabbitmq-diagnostics -n rabbitmq@localhost ping
   ```

### Database Lock Contention

If using multiple instances, ensure `FOR UPDATE SKIP LOCKED` is working properly.

1. Check for long-running transactions:
   ```sql
   SELECT pid, state, query_start, query
   FROM pg_stat_activity
   WHERE state IN ('idle in transaction', 'active')
   ORDER BY query_start;
   ```

### High Memory Usage

Monitor the batch size and reduce if needed:

```bash
export OUTBOX_BATCH_SIZE=50
```

## Development

### Running Tests

```bash
npm test
npm run test:coverage
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Type Checking

```bash
npm run typecheck
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on the repository.
