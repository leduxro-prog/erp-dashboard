# Chaos and Reliability Tests

Enterprise-level chaos and reliability testing suite for the Cypher ERP event system.

## Overview

This test suite validates the resilience and reliability of the event-driven architecture under various failure conditions. The tests ensure that the system can handle:

- Broker restarts
- Duplicate event publishing
- Consumer crashes
- Network partitions
- Idempotency violations
- Performance under load

## Test Structure

```
tests/events/reliability/
├── helpers/
│   ├── ChaosRunner.ts       # Chaos execution framework
│   ├── TestRabbitMQ.ts     # RabbitMQ test utilities
│   ├── TestPostgres.ts      # Postgres test utilities
│   └── index.ts            # Helper exports
├── BrokerRestart.test.ts     # Broker restart resilience
├── DuplicatePublish.test.ts  # Duplicate detection
├── ConsumerCrash.test.ts    # Consumer crash recovery
├── NetworkPartition.test.ts  # Network partition handling
├── Idempotency.test.ts     # Idempotency validation
├── Performance.test.ts       # Performance baselines
└── README.md               # This file
```

## Test Categories

### 1. Broker Restart Tests (`BrokerRestart.test.ts`)

Tests the system's ability to handle RabbitMQ broker restarts.

**Scenarios:**
- Automatic reconnection after connection close
- Preservation of channel state
- Multiple rapid connection failures
- Durable message persistence
- Publisher confirms after restart
- Consumer recovery and redelivery

**Success Criteria:**
- Connection recovery within 5 seconds
- No loss of durable messages
- Unacknowledged messages redelivered
- Publisher confirms working correctly

### 2. Duplicate Publish Tests (`DuplicatePublish.test.ts`)

Tests detection and handling of duplicate event publishes.

**Scenarios:**
- Duplicate event ID detection
- Database-level deduplication
- Idempotent processing
- Correlation ID tracking
- Exactly-once semantics with outbox pattern
- Concurrent processing attempts

**Success Criteria:**
- Unique constraint enforcement
- ON CONFLICT upsert handling
- Exactly-once processing achieved
- No duplicate side effects

### 3. Consumer Crash Tests (`ConsumerCrash.test.ts`)

Tests recovery from consumer crashes.

**Scenarios:**
- Redelivery of unacknowledged messages
- Message order preservation across crashes
- Multiple sequential crashes
- State restoration after crash
- Graceful shutdown handling
- Error handling and tracking

**Success Criteria:**
- Unacknowledged messages redelivered
- State persisted before crash
- Graceful shutdown completes in-progress work
- Error rates tracked accurately

### 4. Network Partition Tests (`NetworkPartition.test.ts`)

Tests handling of network partitions between services.

**Scenarios:**
- Partition detection (RabbitMQ and Postgres)
- Publishing during partition
- Consumption during partition
- Split-brain scenarios
- Eventual consistency after partition
- Graceful degradation

**Success Criteria:**
- Partitions detected within 1 second
- Recovery within 5 second SLA
- Message buffering during partition
- No data loss during recovery

### 5. Idempotency Tests (`Idempotency.test.ts`)

Tests idempotent operation handling.

**Scenarios:**
- Event processing idempotency
- Inventory operation idempotency
- Conditional idempotency
- Business logic idempotency
- Performance under high duplicate rate

**Success Criteria:**
- Exactly-once semantics maintained
- No duplicate state changes
- Concurrent operations handled safely
- Fast duplicate rejection (< 5ms)

### 6. Performance Tests (`Performance.test.ts`)

Establishes performance baselines for the event system.

**Scenarios:**
- Publish throughput
- Publish latency (P50, P95, P99)
- Consume throughput
- Database performance
- End-to-end latency
- Resource usage
- Stress testing

**Performance Thresholds:**

| Metric | Minimum | Target | Maximum |
|--------|----------|---------|----------|
| Throughput | 1000 msg/s | 5000 msg/s | - |
| P50 Latency | - | - | 10ms |
| P95 Latency | - | - | 50ms |
| P99 Latency | - | - | 100ms |
| Memory/Message | - | - | 1KB |

## Helper Utilities

### ChaosRunner

Framework for executing chaos experiments.

```typescript
import { createChaosRunner, PredefinedScenarios } from './helpers';

const runner = createChaosRunner(rmq, pg);

// Run a predefined scenario
const result = await runner.runScenario(
  PredefinedScenarios.brokerRestartDuringPublish(rmq)
);

console.log('Success:', result.success);
console.log('Metrics:', result.metrics);
```

### TestRabbitMQ

RabbitMQ test utilities with failure simulation.

```typescript
import { createTestRabbitMQ, setupTestTopology } from './helpers';

const rmq = createTestRabbitMQ({ url: 'amqp://...' });
await rmq.connect();

const topology = await setupTestTopology(rmq);

// Publish
await rmq.publish(topology.exchange, topology.routingKey, { data: 'test' });

// Simulate failure
await rmq.simulateConnectionFailure(5000);
await rmq.simulateNetworkPartition(5000);
```

### TestPostgres

Postgres test utilities with failure simulation.

```typescript
import { createTestPostgres, enableUUIDExtension } from './helpers';

const pg = createTestPostgres({ host: 'localhost' });
await pg.initialize();
await enableUUIDExtension(pg);

// Create table
await pg.createTable({
  name: 'test_table',
  columns: [
    { name: 'id', type: 'UUID', nullable: false, constraints: ['PRIMARY KEY'] },
    { name: 'data', type: 'JSONB', nullable: false },
  ],
});

// Insert
await pg.insert('test_table', { data: { test: true } });

// Simulate failure
await pg.simulateNetworkPartition(5000);
await pg.simulateHighLatency(3000, 100);
```

## Running Tests

### Run All Tests

```bash
npm test -- tests/events/reliability
```

### Run Specific Test Suite

```bash
npm test -- tests/events/reliability/BrokerRestart.test.ts
```

### Run With Coverage

```bash
npm test -- --coverage tests/events/reliability
```

### Run in CI/CD

```bash
# Ensure services are running
docker-compose up -d rabbitmq postgres

# Run reliability tests
npm run test:reliability

# Collect results
npm run test:reliability:report
```

## Environment Configuration

Tests use the following environment variables:

| Variable | Description | Default |
|----------|-------------|----------|
| RABBITMQ_URL | RabbitMQ connection URL | `amqp://guest:guest@localhost:5672` |
| RABBITMQ_HOST | RabbitMQ host | `localhost` |
| RABBITMQ_PORT | RabbitMQ port | `5672` |
| DB_HOST | Postgres host | `localhost` |
| DB_PORT | Postgres port | `5432` |
| DB_NAME | Postgres database | `cypher_erp_test` |
| DB_USER | Postgres username | `cypher_user` |
| DB_PASSWORD | Postgres password | `cypher_secret` |

## Interpreting Results

### Test Status

- **PASS**: All criteria met, system behaves as expected
- **FAIL**: One or more criteria not met, investigation needed
- **SKIP**: Test skipped due to missing dependencies

### Metrics

Each test scenario produces metrics:

- `totalOperations`: Total operations attempted
- `successfulOperations`: Successful operations count
- `failedOperations`: Failed operations count
- `duplicateOperations`: Duplicate operations detected
- `avgLatency`: Average operation latency (ms)
- `p50Latency`: 50th percentile latency
- `p95Latency`: 95th percentile latency
- `p99Latency`: 99th percentile latency

### Failure Analysis

When tests fail:

1. Check logs for detailed error messages
2. Review metrics to identify degradation patterns
3. Verify service health: `docker ps`
4. Check connection logs: `docker logs rabbitmq`
5. Review database state: `docker exec -it postgres psql ...`

## Best Practices

### Writing New Tests

1. **Use helper utilities** - Leverage existing TestRabbitMQ/TestPostgres
2. **Isolate tests** - Clean up state in beforeEach/afterEach
3. **Define clear criteria** - Specify what success looks like
4. **Add metrics** - Track latency, throughput, error rates
5. **Document scenarios** - Explain what is being tested and why
6. **Handle async** - Use proper async/await patterns

### Test Design Patterns

```typescript
describe('Feature Being Tested', () => {
  let rmq: TestRabbitMQ;
  let pg: TestPostgres;

  beforeAll(async () => {
    // Setup once for all tests
    rmq = createTestRabbitMQ(config);
    await rmq.connect();
  });

  afterAll(async () => {
    // Cleanup once
    await rmq.cleanup();
  });

  beforeEach(async () => {
    // Reset before each test
    rmq.resetStats();
    await rmq.purgeQueue(queue);
  });

  test('specific scenario', async () => {
    // Arrange
    const message = { id: uuid(), type: 'test' };

    // Act
    await rmq.publish(exchange, routingKey, message);

    // Assert
    const count = await rmq.getQueueMessageCount(queue);
    expect(count).toBe(1);
  });
});
```

## Continuous Integration

### GitHub Actions

```yaml
name: Reliability Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      rabbitmq:
        image: rabbitmq:3-management
        ports:
          - 5672:5672
          - 15672:15672
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: cypher_erp_test
          POSTGRES_USER: cypher_user
          POSTGRES_PASSWORD: cypher_secret
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:reliability
```

## Troubleshooting

### Tests Hang

- Increase timeout in `jest.config.js`
- Check service health: `docker ps`
- Review connection status in logs

### Intermittent Failures

- Check for resource exhaustion: `docker stats`
- Verify connection pool settings
- Review retry/backoff configuration

### High Memory Usage

- Limit message batch size
- Check for memory leaks: `node --inspect`
- Review GC logs

## References

- [RabbitMQ Reliability Guide](https://www.rabbitmq.com/reliability.html)
- [PostgreSQL Idempotency Patterns](https://wiki.postgresql.org/wiki/Idempotent)
- [Chaos Engineering Principles](https://principlesofchaos.org/)
- [Jest Testing Best Practices](https://jestjs.io/docs/tutorial-react-native)

## License

Copyright 2024 Cypher ERP. All rights reserved.
