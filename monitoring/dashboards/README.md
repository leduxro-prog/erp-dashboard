# RabbitMQ Events Observability Dashboard

Enterprise-grade monitoring dashboard for RabbitMQ events queue, outbox relay service, and message processing pipeline in Cypher ERP.

## Overview

This observability stack provides comprehensive visibility into:
- Event publishing and consumption throughput
- Queue depth and consumer lag
- Retry rates and dead letter queue (DLQ) monitoring
- Circuit breaker status
- Connection health
- Processing latency (P50/P95/P99)
- Error rates and types

## Dashboard Structure

```
/opt/cypher-erp/monitoring/dashboards/
├── README.md                          # This documentation
├── rabbitmq-events.json               # Grafana dashboard JSON
└── prometheus/
    └── rabbitmq-events.yml            # Prometheus alert rules
```

## Dashboard Panels

### Row 1: Key Metrics (6 Stat Panels)

| Panel | Metric | Thresholds | Purpose |
|-------|--------|------------|---------|
| **Queue Depth** | Total pending messages | Green < 100, Yellow < 500, Orange < 1000, Red > 1000 | Quick view of message backlog |
| **DLQ Messages** | Dead letter queue count | Green = 0, Yellow > 1, Orange > 10, Red > 50 | Detect failed events |
| **RabbitMQ Connection** | Connection status | Green = Connected, Red = Disconnected | Service connectivity |
| **Circuit Breaker** | Circuit breaker state | Green = Closed, Yellow = Half Open, Red = Open | Protection mechanism status |
| **Active Consumers** | Consumer count | Green, Yellow > 5, Red > 20 | Consumer health |
| **Publish Rate** | Messages per second | Green, Red > 1000 ops | Throughput indicator |

### Row 2: Queue & Throughput Monitoring

**Queue Depth by Queue** (Time Series)
- Shows message depth per queue over time
- Helps identify which queues are backing up
- Critical for detecting processing bottlenecks

**Message Throughput** (Time Series)
- Published, Delivered, Acked, Failed rates
- Color-coded: Green (success), Blue (delivery), Purple (acked), Red (failed)
- Identifies processing pipeline health

### Row 3: Performance & Errors

**Retry & Failure Rate** (Time Series)
- Retry rate % of published messages
- Failure rate % of published messages
- Discard rate % of published messages
- Thresholds: Green, Yellow > 5%, Orange > 10%, Red > 20%

**Processing Time (Percentiles)** (Time Series)
- P50, P95, P99 processing latencies
- Unit: milliseconds
- Identifies performance outliers

**Error Rate** (Time Series)
- Publish errors (green when low)
- Database errors (orange when low)
- Rate: errors per second

### Row 4: Distribution Analysis

**Events by Type** (Donut Chart)
- Breakdown of published events by event type
- Helps understand traffic patterns

**Failures by Error Type** (Donut Chart)
- Breakdown of failures by error type
- Guides troubleshooting efforts

**Circuit Breaker Trips** (Time Series)
- Tracks circuit breaker state changes
- Red when trips occur frequently

### Row 5: Outbox Status

**Outbox Queue Status** (Time Series)
- Pending events
- Processing events
- Failed events
- Discarded events

**Publish Latency (Percentiles)** (Time Series)
- P50, P95, P99 publish latencies
- Measures time from outbox to RabbitMQ

### Row 6: Retry Patterns

**Retries by Attempt** (Time Series)
- Distribution of retries by attempt number (1, 2, 3, 4+)
- Identifies patterns in retry behavior

**Batch Size Distribution** (Time Series)
- P50, P90, P95 batch sizes
- Optimization insights for batch processing

### Row 7: Processing Analysis

**Batch Processing Time** (Time Series)
- P50, P95, P99 batch processing durations
- Overall batch operation performance

**Message State Distribution** (Time Series)
- Unacknowledged message percentage
- Ready message percentage

### Row 8: Health Indicators

**Overall Success Rate** (Time Series)
- Success rate as percentage
- Critical threshold: Yellow < 50%, Red < 100%

**RabbitMQ Memory Usage** (Time Series)
- Actual memory usage vs high watermark limit
- Unit: bytes

## Metrics Reference

### Outbox Relay Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `outbox_events_published_total` | Counter | event_type, event_domain, exchange, routing_key | Total events published |
| `outbox_events_failed_total` | Counter | event_type, event_domain, error_type, exchange, routing_key | Total events failed |
| `outbox_events_retried_total` | Counter | event_type, event_domain, attempt | Total retry attempts |
| `outbox_events_discarded_total` | Counter | event_type, event_domain, reason | Total events discarded |
| `outbox_publish_errors_total` | Counter | error_type, error_code | Publish operation errors |
| `outbox_database_errors_total` | Counter | operation, error_type | Database operation errors |
| `outbox_circuit_breaker_trips_total` | Counter | component, state_from, state_to | Circuit breaker trips |
| `outbox_processing_time_seconds` | Gauge | phase | Current processing time |
| `outbox_batch_size` | Gauge | - | Current batch size |
| `outbox_queue_depth` | Gauge | status | Queue depth by status |
| `outbox_postgres_connection_status` | Gauge | - | Postgres connection (0/1) |
| `outbox_rabbitmq_connection_status` | Gauge | - | RabbitMQ connection (0/1) |
| `outbox_circuit_breaker_state` | Gauge | component | CB state: 0=closed, 1=open, 2=half_open |
| `outbox_event_processing_duration_seconds` | Histogram | event_type, event_domain | Event processing duration |
| `outbox_batch_processing_duration_seconds` | Histogram | - | Batch processing duration |
| `outbox_publish_duration_seconds` | Histogram | exchange, routing_key | Publish operation duration |
| `outbox_events_per_batch` | Summary | result | Events per batch summary |

### RabbitMQ Metrics

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `rabbitmq_queue_messages` | Gauge | queue, vhost | Total messages in queue |
| `rabbitmq_queue_messages_ready` | Gauge | queue, vhost | Messages ready for delivery |
| `rabbitmq_queue_messages_unacked` | Gauge | queue, vhost | Unacknowledged messages |
| `rabbitmq_queue_consumers` | Gauge | queue, vhost | Active consumers |
| `rabbitmq_queue_messages_published_total` | Counter | queue, vhost | Total messages published |
| `rabbitmq_queue_messages_delivered_total` | Counter | queue, vhost | Total messages delivered |
| `rabbitmq_queue_messages_acked_total` | Counter | queue, vhost | Total messages acked |
| `rabbitmq_process_resident_memory_bytes` | Gauge | node | Memory usage |
| `rabbitmq_vm_memory_high_watermark_bytes` | Gauge | node | Memory limit |

## Alert Rules

Alert rules are defined in `/opt/cypher-erp/monitoring/dashboards/prometheus/rabbitmq-events.yml`

### Alert Groups

#### 1. Queue Depth and Lag Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsQueueDepthHigh` | warning | Queue depth > 500 | 5m |
| `RabbitMQEventsQueueDepthCritical` | critical | Queue depth > 1000 | 2m |
| `RabbitMQEventsConsumerLag` | warning | Production > consumption by 50% | 5m |

#### 2. Dead Letter Queue Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsDLQMessagesDetected` | warning | DLQ has messages | 1m |
| `RabbitMQEventsDLQCriticalCount` | critical | DLQ > 50 messages | 2m |
| `RabbitMQEventsDLQHighRate` | critical | Discard rate > 1/sec | 2m |

#### 3. Retry Rate Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsHighRetryRate` | warning | Retry rate > 10% | 5m |
| `RabbitMQEventsExcessiveRetries` | critical | 3rd+ attempts > 2% | 5m |
| `RabbitMQEventsSingleEventHighRetries` | warning | Single event > 10 retries | 1m |

#### 4. Error Rate Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsHighErrorRate` | warning | Failure rate > 5% | 5m |
| `RabbitMQEventsCriticalErrorRate` | critical | Failure rate > 20% | 2m |
| `RabbitMQEventsPublishErrorSpike` | critical | Publish errors > 10/sec | 2m |
| `RabbitMQEventsDatabaseErrorSpike` | critical | DB errors > 5/sec | 2m |

#### 5. Circuit Breaker Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsCircuitBreakerOpen` | critical | Circuit breaker state = 1 | 1m |
| `RabbitMQEventsCircuitBreakerFrequentTrips` | warning | Trip rate > 0.1/sec | 5m |

#### 6. Connection Health Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsConnectionDown` | critical | RabbitMQ connection = 0 | 1m |
| `RabbitMQEventsPostgresConnectionDown` | critical | Postgres connection = 0 | 1m |
| `RabbitMQEventsNoConsumers` | warning | No active consumers | 5m |

#### 7. Throughput Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsLowThroughput` | info | Publish rate < 1/sec | 10m |
| `RabbitMQEventsThroughputDrop` | warning | Drop > 50% | 5m |

#### 8. Processing Time Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsProcessingTimeHigh` | warning | P95 > 5s | 5m |
| `RabbitMQEventsProcessingTimeCritical` | critical | P95 > 30s | 2m |
| `RabbitMQEventsPublishLatencyHigh` | warning | P95 > 1s | 5m |
| `RabbitMQEventsBatchProcessingSlow` | warning | P95 > 10s | 5m |

#### 9. Resource Usage Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsMemoryUsageHigh` | warning | Memory > 80% | 5m |
| `RabbitMQEventsMemoryUsageCritical` | critical | Memory > 95% | 2m |

#### 10. Composite Health Alerts
| Alert | Severity | Condition | For |
|-------|----------|-----------|-----|
| `RabbitMQEventsHealthDegraded` | warning | Multiple issues | 5m |
| `RabbitMQEventsHealthCritical` | critical | Critical issue | 2m |

## Installation

### Prerequisites

- Grafana (v9.0+)
- Prometheus (v2.40+)
- RabbitMQ with Prometheus exporter
- Outbox Relay service running with metrics enabled

### Steps

1. **Copy dashboard to Grafana:**

```bash
# Via Grafana UI
# 1. Go to Dashboards -> Import
# 2. Upload /opt/cypher-erp/monitoring/dashboards/rabbitmq-events.json
# 3. Select Prometheus datasource
# 4. Click Import

# Or via API
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -u admin:admin \
  -d @/opt/cypher-erp/monitoring/dashboards/rabbitmq-events.json
```

2. **Configure Prometheus alert rules:**

```bash
# Add to prometheus.yml
rule_files:
  - /opt/cypher-erp/monitoring/dashboards/prometheus/rabbitmq-events.yml

# Reload Prometheus
curl -X POST http://localhost:9090/-/reload
```

3. **Verify metrics are being collected:**

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Query specific metrics
curl 'http://localhost:9090/api/v1/query?query=outbox_events_published_total'
```

## Docker Compose Integration

Add to your `docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml
      - ./monitoring/dashboards/prometheus:/etc/prometheus/rabbitmq-events
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
```

## Grafana Provisioning (Optional)

Create `/opt/cypher-erp/monitoring/grafana/provisioning/dashboards/rabbitmq-events.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'RabbitMQ Events'
    orgId: 1
    folder: 'Cypher ERP'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

## Troubleshooting

### Dashboard Shows No Data

1. **Check Prometheus targets:**
```bash
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'
```

2. **Check metrics endpoint availability:**
```bash
# Outbox relay metrics
curl http://localhost:9091/metrics

# RabbitMQ exporter metrics
curl http://localhost:15692/metrics
```

3. **Verify Prometheus configuration:**
```bash
promtool check config /etc/prometheus/prometheus.yml
```

### Alerts Not Firing

1. **Check alert rules are loaded:**
```bash
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name=="rabbitmq_events_*")'
```

2. **Test alert expression:**
```bash
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=outbox_queue_depth{status="pending"} > 500'
```

3. **Check Alertmanager configuration:**
```bash
curl http://localhost:9093/api/v1/status
```

### High Memory Usage

1. **Check queue depth:**
```bash
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=sum(rabbitmq_queue_messages)'
```

2. **Review memory limit:**
```bash
rabbitmqctl status | grep vm_memory_high_watermark
```

3. **Consider increasing memory or purging old queues**

## Best Practices

### Alert Tuning

1. **Adjust thresholds based on your traffic patterns:**
   - Low traffic: Lower thresholds for faster detection
   - High traffic: Higher thresholds to avoid alert fatigue

2. **Use alert grouping to prevent notification spam:**
   ```yaml
   group_by: [alertname, service]
   group_wait: 10s
   group_interval: 5m
   repeat_interval: 1h
   ```

3. **Set up on-call rotation for critical alerts:**

### Dashboard Customization

1. **Add variables for filtering:**
   - Event domains
   - Queue names
   - Consumer groups

2. **Create row repeats for multiple environments:**
   - Development
   - Staging
   - Production

3. **Add annotations for deployments:**

### Performance Considerations

1. **Limit query time ranges for large metrics:**
   - Default: `from: now-1h`
   - Historical analysis: `from: now-7d`

2. **Use recording rules for expensive queries:**

```yaml
groups:
  - name: rabbitmq_events_recording
    interval: 30s
    rules:
      - record: job:outbox_events_published_total:rate5m
        expr: sum by (job) (rate(outbox_events_published_total[5m]))
```

3. **Configure metric retention:**
   ```yaml
   # prometheus.yml
   storage:
     tsdb:
       retention.time: 30d
   ```

## Runbooks

### High Queue Depth

**Symptoms:**
- Queue depth > 1000 messages
- Consumer lag increasing
- Processing time increasing

**Actions:**
1. Check consumer service status
2. Review processing logs for errors
3. Consider scaling consumers horizontally
4. Check for stuck messages
5. Verify RabbitMQ resources

### Circuit Breaker Open

**Symptoms:**
- Circuit breaker state = OPEN
- No events being published
- RabbitMQ connection errors

**Actions:**
1. Verify RabbitMQ service health
2. Check network connectivity
3. Review error logs
4. Manually reset circuit breaker after fixing root cause
5. Consider increasing failure threshold

### High DLQ Count

**Symptoms:**
- DLQ has messages accumulating
- Discard rate increasing
- Events failing after max retries

**Actions:**
1. Analyze DLQ message content
2. Identify common error patterns
3. Fix root cause of failures
4. Replay or manually process DLQ messages
5. Update event schemas if validation errors

### High Error Rate

**Symptoms:**
- Failure rate > 5%
- Publish or database errors spiking
- Consumer processing errors

**Actions:**
1. Check error types and codes
2. Review service logs
3. Verify external service availability
4. Check for rate limiting
5. Review recent code changes

## Related Documentation

- [RabbitMQ Management Plugin](https://www.rabbitmq.com/management.html)
- [Prometheus RabbitMQ Exporter](https://github.com/kbudde/rabbitmq_exporter)
- [Outbox Relay Service](/opt/cypher-erp/modules/outbox-relay/README.md)
- [Event Schema Registry](/opt/cypher-erp/events/registry/README.md)

## Support

For issues or questions:
- GitHub Issues: [Cypher ERP Repository]
- Documentation: [Cypher ERP Docs]
- Monitoring Team: observability@cypher.ro

## Changelog

### v1.0.0 (2026-02-13)
- Initial release
- 22 dashboard panels
- 30+ alert rules
- Enterprise-level observability coverage
- Support for outbox relay metrics
- RabbitMQ integration
