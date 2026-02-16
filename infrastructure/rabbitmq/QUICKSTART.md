# RabbitMQ Event Bus - Quick Start Guide

## Prerequisites

- Docker and Docker Compose installed
- Terraform >= 1.5.0 installed
- Basic knowledge of RabbitMQ concepts

## Step 1: Start RabbitMQ Locally

```bash
cd /opt/cypher-erp/infrastructure/rabbitmq
docker-compose up -d
```

This starts:
- RabbitMQ with Management UI on ports 5672 (AMQP) and 15672 (UI)

Verify it's running:
```bash
docker-compose ps
curl http://localhost:15672
```

## Step 2: Initialize Terraform

```bash
terraform init
```

## Step 3: Plan and Apply

```bash
terraform plan -var-file="env/dev.tfvars"
terraform apply -var-file="env/dev.tfvars"
```

Type `yes` when prompted to apply the changes.

## Step 4: Verify Topology

Access the RabbitMQ Management UI:
```
http://localhost:15672
Username: admin
Password: admin
```

Check the following:
- **Exchanges**: 3 exchanges created (events, retry, dlq)
- **Queues**: 21 queues created (5 main, 12 retry, 4 DLQ)
- **Bindings**: 21 bindings created

## Step 5: Test with a Simple Publisher

Create a test publisher script:

```javascript
// test-publisher.js
const amqp = require('amqplib');

async function test() {
  const conn = await amqp.connect('amqp://localhost');
  const ch = await conn.createChannel();

  await ch.assertExchange('cypher.dev.events.topic', 'topic', { durable: true });

  const event = {
    eventId: 'test-' + Date.now(),
    eventType: 'product.updated',
    timestamp: new Date().toISOString(),
    payload: { productId: 'test-123', name: 'Test Product' }
  };

  ch.publish(
    'cypher.dev.events.topic',
    'product.updated',
    Buffer.from(JSON.stringify(event))
  );

  console.log('Message sent:', event);
  await conn.close();
}

test();
```

Run with:
```bash
npm install amqplib
node test-publisher.js
```

## Step 6: Test with a Simple Consumer

Create a test consumer script:

```javascript
// test-consumer.js
const amqp = require('amqplib');

async function test() {
  const conn = await amqp.connect('amqp://localhost');
  const ch = await conn.createChannel();

  const queue = 'cypher.dev.search-indexer.product-updated';
  await ch.assertQueue(queue, { durable: true });
  await ch.prefetch(1);

  console.log('Waiting for messages...');

  ch.consume(queue, (msg) => {
    const content = JSON.parse(msg.content.toString());
    console.log('Received:', content);
    ch.ack(msg);
  });
}

test();
```

## Step 7: View Outputs

```bash
terraform output
```

Get the application config:
```bash
terraform output -json application_config | jq
```

## Step 8: Cleanup

Stop RabbitMQ:
```bash
docker-compose down
```

Remove volumes and data:
```bash
docker-compose down -v
```

Destroy Terraform resources:
```bash
terraform destroy -var-file="env/dev.tfvars"
```

## Optional: Enable Monitoring

To start Prometheus and Grafana:
```bash
docker-compose --profile monitoring up -d
```

Access:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

## Troubleshooting

### Connection Refused
```bash
# Check if RabbitMQ is running
docker-compose ps

# Check logs
docker-compose logs -f
```

### Terraform Errors
```bash
# Reset Terraform state (WARNING: destructive!)
rm -rf .terraform terraform.tfstate
terraform init
```

### Permission Denied
Ensure RabbitMQ user has management API permissions.

## Next Steps

- Read the full [README.md](README.md) for detailed configuration
- Add new events to the topology
- Implement consumer services
- Set up monitoring and alerting
