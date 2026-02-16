# Cypher ERP - RabbitMQ Event Bus Topology

## Overview

This Terraform configuration defines the complete RabbitMQ topology for the Cypher ERP B2B event bus. It implements enterprise-grade messaging patterns including topic exchanges, durable queues, dead letter queues (DLQ), and retry mechanisms with exponential backoff.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cypher ERP Event Bus                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Publishers                                                                │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │         cypher.{env}.events.topic                    │                   │
│  │              (Topic Exchange)                       │                   │
│  └──────────────┬──────────────────────┬──────────────┘                   │
│                 │                      │                                     │
│         ┌───────▼──────┐       ┌──────▼───────┐                               │
│         │ Main Queues  │       │  Failures    │                               │
│         │ (Consumers)  │       │  to DLX      │                               │
│         └──────────────┘       └──┬───────────┘                               │
│                                    │                                          │
│                         ┌──────────▼──────────┐                              │
│                         │ cypher.{env}.events.dlq                           │
│                         │    (Dead Letter)     │                              │
│                         └─────────────────────┘                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │         cypher.{env}.events.retry                   │                   │
│  │           (Retry Exchange)                          │                   │
│  └──────┬────────────┬────────────┬─────────────┬──────┘                   │
│         │ 10s        │ 60s        │ 300s        │                            │
│         ▼            ▼            ▼            ▼                             │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│    │Retry #1 │  │Retry #2 │  │Retry #3 │  │  DLQ    │                    │
│    └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘                    │
│         │            │            │            │                            │
│         └────────────┴────────────┴────────────┘                            │
│                    │ (TTL expires, DLX returns)                             │
│                    ▼                                                         │
│          ┌──────────────────────┐                                           │
│          │ Back to events.topic │                                           │
│          └──────────────────────┘                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### Exchanges

| Exchange Name | Type | Purpose |
|--------------|------|---------|
| `cypher.{env}.events.topic` | topic | Main exchange for all domain events |
| `cypher.{env}.events.retry` | topic | Retry exchange for failed messages |
| `cypher.{env}.events.dlq` | topic | Dead letter exchange for exhausted messages |

### Main Queues

| Queue Name | Event | Worker | Max TTL |
|------------|-------|--------|---------|
| `q.search-indexer.product-updated` | product.updated | search-indexer-service | 24h |
| `q.pricing-worker.price-changed` | price.changed | pricing-worker-service | 24h |
| `q.notification-worker.order-created` | order.created | notification-worker-service | 7d |
| `q.credit-worker.order-cancelled` | order.cancelled | credit-worker-service | 12h |
| `q.erp-sync.order-created` | order.created | erp-sync-service | 24h |

### Retry Strategy

Messages are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 10 seconds |
| 2 | 60 seconds (1 minute) |
| 3 | 300 seconds (5 minutes) |
| 4+ | Sent to DLQ |

### Supported Events

- `product.created`
- `product.updated`
- `product.deleted`
- `price.changed`
- `order.created`
- `order.paid`
- `order.cancelled`
- `order.shipped`
- `customer.registered`
- `customer.updated`

## Getting Started

### Prerequisites

- Terraform >= 1.5.0
- RabbitMQ server with management plugin enabled
- RabbitMQ user with management API permissions

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cypher-erp/infrastructure/rabbitmq
```

2. Initialize Terraform:
```bash
terraform init
```

3. Configure variables. Create a `env/dev.tfvars` file:
```hcl
rabbitmq_host     = "localhost"
rabbitmq_port     = 15672
rabbitmq_username = "admin"
rabbitmq_password = "admin"
environment       = "dev"
```

4. Plan the changes:
```bash
terraform plan -var-file="env/dev.tfvars"
```

5. Apply the configuration:
```bash
terraform apply -var-file="env/dev.tfvars"
```

## Local Development

For local development, use the provided Docker Compose configuration:

```bash
# Start RabbitMQ with Management UI
docker-compose up -d

# Access Management UI
# http://localhost:15672
# Username: admin
# Password: admin

# Stop RabbitMQ
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Configuration

### Input Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `rabbitmq_host` | RabbitMQ management API host | `localhost` |
| `rabbitmq_port` | RabbitMQ management API port | `15672` |
| `rabbitmq_username` | Management API username | `admin` |
| `rabbitmq_password` | Management API password | `admin` |
| `environment` | Deployment environment | `dev` |
| `retry_enabled` | Enable retry mechanism | `true` |
| `retry_max_attempts` | Maximum retry attempts | `3` |

### Environment-Specific Configurations

#### Development (`dev`)
```hcl
rabbitmq_host     = "localhost"
rabbitmq_port     = 15672
environment       = "dev"
retry_max_attempts = 3
```

#### Staging (`staging`)
```hcl
rabbitmq_host     = "rabbitmq-staging.cypher.ro"
rabbitmq_port     = 15672
environment       = "staging"
retry_max_attempts = 5
```

#### Production (`prod`)
```hcl
rabbitmq_host     = "rabbitmq-prod.cypher.ro"
rabbitmq_port     = 15672
rabbitmq_protocol = "https"
environment       = "prod"
retry_max_attempts = 5
```

## Outputs

After applying, Terraform outputs important connection information:

```bash
terraform output
```

Key outputs:
- `rabbitmq_amqp_url` - AMQP connection string
- `exchange_events` - Main events exchange name
- `all_main_queues` - List of all queue names
- `application_config` - Full configuration object

## Message Flow

### Successful Message Flow

```
1. Publisher publishes to cypher.{env}.events.topic
   with routing key "product.updated"

2. Message routed to q.search-indexer.product-updated

3. Consumer processes message

4. Message acknowledged (ACK)
```

### Failed Message with Retry

```
1. Consumer fails to process message

2. Consumer NACKs (or rejects) message

3. Message republished to cypher.{env}.events.retry
   with routing key "product.updated.retry.1"

4. Retry queue holds message for 10 seconds (TTL)

5. After TTL, DLX forwards to cypher.{env}.events.topic

6. Message reprocessed by consumer

7. If fails again, cycle repeats with routing key
   "product.updated.retry.2" (60 seconds)

8. After 3 failed attempts, sent to DLQ
```

### DLQ Handling

```
1. After max retry attempts, message sent to
   cypher.{env}.events.dlq exchange

2. Message routed to q.dlq.product.updated

3. Inspect via Management UI or API

4. After fixing issue, republish to main exchange
   or use shoveling to move messages back
```

## Consumer Implementation Guide

### Basic Consumer Pattern (Node.js/TypeScript)

```typescript
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://localhost:5672');
const channel = await connection.createChannel();

const queue = 'cypher.dev.search-indexer.product-updated';
const exchange = 'cypher.dev.events.topic';

// Declare topology (or rely on Terraform)
await channel.assertExchange(exchange, 'topic', { durable: true });
await channel.assertQueue(queue, {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': 'cypher.dev.events.dlq',
    'x-dead-letter-routing-key': 'product.updated'
  }
});
await channel.bindQueue(queue, exchange, 'product.updated');

// Consume messages
await channel.consume(queue, async (msg) => {
  if (!msg) return;

  try {
    // Process message
    const event = JSON.parse(msg.content.toString());
    await processProductUpdate(event);
    channel.ack(msg);
  } catch (error) {
    // Check retry count from headers
    const retryCount = msg.properties.headers['x-retry-count'] || 0;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      // Publish to retry exchange
      channel.publish(
        'cypher.dev.events.retry',
        `product.updated.retry.${retryCount + 1}`,
        msg.content,
        {
          headers: { 'x-retry-count': retryCount + 1 }
        }
      );
      channel.ack(msg);
    } else {
      // Send to DLQ
      channel.nack(msg, false, false);
    }
  }
});
```

### Publisher Pattern (Node.js/TypeScript)

```typescript
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://localhost:5672');
const channel = await connection.createChannel();

const exchange = 'cypher.dev.events.topic';

await channel.assertExchange(exchange, 'topic', { durable: true });

// Publish event
const event = {
  eventId: 'evt_123',
  eventType: 'product.updated',
  timestamp: new Date().toISOString(),
  payload: {
    productId: 'prod_456',
    name: 'Updated Product',
    price: 99.99
  }
};

channel.publish(
  exchange,
  'product.updated',
  Buffer.from(JSON.stringify(event)),
  {
    contentType: 'application/json',
    messageId: event.eventId,
    timestamp: Date.now()
  }
);
```

## Monitoring and Observability

### RabbitMQ Management UI

Access at: `http://{host}:15672`

Key metrics to monitor:
- Queue depth (number of messages)
- Message rates (publish/consume)
- DLQ message counts
- Connection and channel counts

### Prometheus Metrics

Enable RabbitMQ Prometheus exporter:

```bash
docker exec rabbitmq rabbitmq-plugins enable rabbitmq_prometheus
```

Key metrics:
- `rabbitmq_queue_messages` - Queue depth
- `rabbitmq_queue_messages_ready` - Ready messages
- `rabbitmq_queue_messages_unacked` - Unacknowledged messages
- `rabbitmq_queue_message_rate_publish_total` - Publish rate
- `rabbitmq_queue_message_rate_deliver_total` - Consume rate

### Alerting Rules

Recommended alerts:
- High queue depth (> 10,000 messages)
- DLQ messages present (> 100 messages)
- No consumers for > 5 minutes
- Failed message rate increasing

## Best Practices

### 1. Message Design

```json
{
  "eventId": "uuid",
  "eventType": "product.updated",
  "eventVersion": "1.0",
  "occurredAt": "2024-01-01T00:00:00Z",
  "aggregateId": "prod_123",
  "payload": { ... },
  "metadata": {
    "correlationId": "uuid",
    "causationId": "uuid",
    "userId": "user_123"
  }
}
```

### 2. Error Handling

- Always validate messages before processing
- Log errors with full context
- Use structured logging
- Monitor DLQ for issues

### 3. Idempotency

- Design consumers to handle duplicate messages
- Use eventId for deduplication
- Implement idempotent operations

### 4. Ordering

- Within a single queue, messages are ordered FIFO
- For ordering guarantees across messages, use single consumer
- Consider message groups for related messages

### 5. Backpressure

- Implement prefetch limit
- Monitor consumer lag
- Scale consumers as needed

## Troubleshooting

### Common Issues

#### Messages not reaching consumers
1. Check bindings in Management UI
2. Verify routing keys match
3. Check queue permissions
4. Review connection status

#### High message backlog
1. Check consumer health
2. Verify processing logic
3. Scale up consumers
4. Check for bottlenecks

#### DLQ filling up
1. Review DLQ messages for patterns
2. Check for transient vs permanent failures
3. Update retry strategy if needed
4. Fix root cause before republishing

### Commands

```bash
# List queues
rabbitmqadmin list queues name messages

# List bindings
rabbitmqadmin list bindings source destination routing_key

# Purge queue
rabbitmqadmin purge queue name=cypher.dev.dlq.product.updated

# Get queue details
rabbitmqadmin get queue=cypher.dev.search-indexer.product-updated

# Move messages from DLQ to main queue
rabbitmqsh > move_messages "cypher.dev.dlq.product.updated" "cypher.dev.events.topic" "product.updated"
```

## Maintenance

### Adding New Events

1. Add new queue in `queues.tf`
2. Add binding in `bindings.tf`
3. Add retry queues in `retry.tf` (optional)
4. Apply changes:
```bash
terraform apply -var-file="env/dev.tfvars"
```

### Updating Retry TTLs

Modify the `retry_ttls` in `main.tf`:
```hcl
retry_ttls = {
  attempt_1 = 15000  # 15 seconds
  attempt_2 = 120000 # 2 minutes
  attempt_3 = 600000 # 10 minutes
}
```

### Backup and Restore

```bash
# Export queue definitions
rabbitmqadmin export > rabbitmq-backup.json

# Import queue definitions
rabbitmqadmin import rabbitmq-backup.json
```

## Security Considerations

1. Use strong passwords for RabbitMQ users
2. Enable SSL/TLS in production
3. Implement proper user permissions
4. Use separate vhosts for different environments
5. Audit access to Management UI
6. Enable firewall rules for RabbitMQ ports

## License

Copyright (c) 2024 Cypher ERP. All rights reserved.

## Support

For issues or questions, contact:
- Email: support@cypher.ro
- Documentation: https://docs.cypher.ro/events
