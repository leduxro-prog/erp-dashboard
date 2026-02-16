# E2E Tests

End-to-end tests for the Cypher ERP event bus and jobs infrastructure.

## Directory Structure

```
tests/e2e/
├── eventbus/
│   ├── EventBusE2ETest.ts      # Main event bus E2E tests
│   ├── AuditTrailValidator.ts    # Audit trail validation utilities
│   ├── MetricsValidator.ts       # Prometheus metrics validation
│   ├── AlertValidator.ts        # Alert validation utilities
│   ├── helpers/
│   │   ├── E2ETestHelper.ts   # E2E test helper (RabbitMQ + Postgres)
│   │   ├── MetricsHelper.ts    # Prometheus query helper
│   │   └── AlertHelper.ts     # Alert manager interaction helper
│   └── index.ts
└── jobs/
    ├── JobsE2ETest.ts          # Jobs E2E tests
    └── index.ts
```

## Event Bus E2E Tests

### Test Coverage

1. **Happy Path**: `event -> consumer -> success`
   - Publishes event and verifies successful processing
   - Validates audit trail creation
   - Verifies metrics are updated

2. **Retry Logic**: `event -> consumer -> retry -> success`
   - Tests event retry with exponential backoff
   - Verifies retry attempts in audit trail
   - Validates retry metrics

3. **DLQ Handling**: `event -> consumer -> retry exhausted -> DLQ`
   - Tests event moves to DLQ after max retries
   - Validates DLQ alert firing
   - Verifies DLQ state

4. **DLQ Redrive**: `DLQ -> redrive -> consumer -> idempotent success`
   - Tests redriving messages from DLQ
   - Verifies idempotent processing

5. **Consumer Crash**: `event -> consumer crash -> restart -> resume`
   - Simulates consumer failure
   - Tests message recovery after restart

6. **Multiple Consumers**: Multiple consumers for same event
   - Tests competing consumers
   - Validates each consumer receives events

7. **Event Ordering**: Event ordering preservation
   - Publishes multiple events in sequence
   - Verifies events are processed in order

8. **Correlation Chain**: Event correlation chain validation
   - Creates chain of related events
   - Validates causation IDs and correlation IDs

9. **No Alerts on Success**: Verify no alerts fire on successful processing
   - Validates alert manager silence on success

10. **Metrics Updated**: Verify processing duration metrics
    - Tests histogram metrics are updated
    - Validates processing duration recorded

## Jobs E2E Tests

### Test Coverage

1. **Job Creation from Event**: Job creation from event payload
   - Tests job added to queue
   - Validates job state

2. **Job Execution**: Job execution and completion
   - Tests successful job processing
   - Validates job completion

3. **Job Failure and Retry**: Job failure and retry
   - Tests failed job retry logic
   - Validates eventual success

4. **Job DLQ**: Job DLQ and redrive
   - Tests job moves to DLQ after max retries
   - Tests redrive functionality

5. **Job Idempotency**: Job idempotency on retry
   - Tests side-effect idempotency
   - Validates no duplicate effects

6. **Delayed Job**: Delayed job execution
   - Tests delayed job execution
   - Validates execution timing

7. **Job Priority**: Job priority processing
   - Tests higher priority jobs process first

8. **Job Progress**: Job with progress updates
   - Tests progress reporting
   - Validates progress updates

9. **Job Dependencies**: Job dependencies (parent-child)
   - Tests child waits for parent
   - Validates execution order

10. **Bulk Operations**: Bulk job operations
    - Tests bulk job processing
    - Validates all items processed

## Running Tests

### Run all E2E tests
```bash
npm test tests/e2e
```

### Run event bus E2E tests
```bash
npm test tests/e2e/eventbus/EventBusE2ETest.ts
```

### Run jobs E2E tests
```bash
npm test tests/e2e/jobs/JobsE2ETest.ts
```

### Run with coverage
```bash
npm run test:coverage tests/e2e
```

## Environment Variables

The following environment variables can be configured for E2E tests:

```bash
# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_VHOST=/

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cypher_erp_test
DB_USER=cypher_user
DB_PASSWORD=cypher_secret
DB_SCHEMA=shared

# Redis (for jobs)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Prometheus
PROMETHEUS_URL=http://localhost:9090
METRICS_URL=http://localhost:9090/metrics

# Alert Manager
ALERT_MANAGER_URL=http://localhost:3000/api/alerts
ALERT_URL=http://localhost:3000/api/alerts
TEST_WEBHOOK_URL=
```

## Test Dependencies

### Required Services

1. **RabbitMQ**: Message broker for event bus
2. **PostgreSQL**: Database for audit trail storage
3. **Redis**: Queue backend for jobs
4. **Prometheus** (optional): Metrics collection
5. **AlertManager** (optional): Alert validation

### Setup with Docker Compose

```bash
# Start test environment
docker compose -f docker-compose.test.yml up -d

# Run tests
npm test tests/e2e

# Cleanup
docker compose -f docker-compose.test.yml down
```

## Audit Trail Validation

The `AuditTrailValidator` validates:

- `outbox_events` table:
  - Event record created with correct status
  - Timestamps (occurred_at, created_at, published_at) consistent
  - Event sequence preserved

- `processed_events` table:
  - Processing record created for each consumer
  - Consumer name and status correctly stored
  - Processing duration recorded

- Correlation chain:
  - Correlation ID propagated through related events
  - Causation ID links parent-child events
  - No cycles in correlation chain

## Metrics Validation

The `MetricsValidator` validates Prometheus metrics:

- `events_published_total`: Counter incremented on publish
- `events_failed_total`: Counter incremented on failure
- `events_retried_total`: Counter incremented on retry
- `event_processing_duration_seconds`: Histogram updated with processing time
- `rabbitmq_queue_depth`: Gauge reflects queue depth
- `rabbitmq_consumer_lag`: Gauge reflects consumer lag

## Alert Validation

The `AlertValidator` validates alert firing:

- DLQ alert: Fired when dead letter queue has messages
- Retry rate alert: Fired when retry rate exceeds threshold
- Circuit breaker alert: Fired when circuit breaker state changes
- Health degradation alert: Fired when component health degrades

## Test Isolation

Each test:

- Uses unique correlation IDs
- Creates test-specific queues and exchanges
- Cleans up test data after completion
- Truncates test tables between tests

## Best Practices

1. **Always cleanup**: Ensure cleanup runs even on test failure
2. **Use unique IDs**: Generate unique event/job IDs per test
3. **Validate state**: Assert expected state after operations
4. **Handle async**: Properly await async operations
5. **Set timeouts**: Use reasonable timeouts for async waits
