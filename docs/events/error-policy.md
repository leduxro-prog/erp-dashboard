# Error Policy - Cypher ERP Event Bus
**Version:** 1.0
**Date:** 2026-02-13
**Status:** APPROVED

---

## Table of Contents

1. [Error Classification](#1-error-classification)
2. [Retry Matrix per Error Type](#2-retry-matrix-per-error-type)
3. [Poison Message Handling](#3-poison-message-handling)
4. [DLQ Monitoring and Alerting](#4-dlq-monitoring-and-alerting)
5. [Recovery Procedures](#5-recovery-procedures)
6. [Error Categories](#6-error-categories)
7. [Error Response Codes](#7-error-response-codes)
8. [Best Practices](#8-best-practices)
9. [Troubleshooting Guide](#9-troubleshooting-guide)
10. [Configuration Examples](#10-configuration-examples)

---

## 1. Error Classification

### 1.1 Classification Hierarchy

Errors in the event system are classified into four primary categories based on recoverability and business impact:

```
Error Classification
├── Transient Errors (Retryable)
│   ├── Network Failures
│   ├── Temporary Resource Unavailability
│   ├── Rate Limiting
│   └── Temporary Service Degradation
├── Recoverable Errors (Business Logic)
│   ├── Data Validation Errors
│   ├── Business Rule Violations
│   └── External Service Errors
├── Permanent Errors (Non-Retryable)
│   ├── Schema Validation Failures
│   ├── Invalid Reference Errors
│   └── Configuration Errors
└── Critical Errors (Immediate Action Required)
│   ├── Poison Messages
│   ├── Data Corruption
│   └── Security Violations
```

### 1.2 Error Classification Matrix

| Classification | Description | Retry Strategy | DLQ Action | Alert Level |
|----------------|-------------|-----------------|------------|-------------|
| **Transient** | Temporary infrastructure issues | Automatic retry with backoff | After max retries | Warning |
| **Recoverable** | Business logic errors that may resolve | Limited retry | After max retries | Warning |
| **Permanent** | Errors that cannot be resolved by retrying | No retry | Immediate | Error |
| **Critical** | System-threatening errors | No retry | Immediate + Notify | Critical |

### 1.3 Error Decision Tree

```
                ┌─────────────┐
                │ Error Occurs│
                └──────┬──────┘
                       │
            ┌──────────┴──────────┐
            │                     │
       Schema Valid?        Network Related?
            │                     │
       ┌────┴────┐         ┌────┴────┐
       │ Yes     │ No      │ Yes     │ No
       ▼         ▼         ▼         ▼
   ┌─────────┐ ┌───────┐ ┌───────┐ ┌─────────┐
   │Process  │ │DLQ    │ │Retry  │ │Check    │
   │Normal  │ │Direct │ │w/Back │ │Business │
   └─────────┘ └───────┘ └───────┘ │Logic   │
                                   └────┬────┘
                                        │
                                 ┌──────┴──────┐
                                 │             │
                            Recoverable?   Permanent?
                                 │             │
                            ┌────┴────┐  ┌────┴────┐
                            │Retry   │  │DLQ     │
                            │Limited │  │Direct  │
                            └─────────┘  └─────────┘
```

---

## 2. Retry Matrix per Error Type

### 2.1 Standard Retry Strategy

The Cypher ERP event bus implements a three-tier retry strategy with exponential backoff:

| Retry Level | Delay | TTL | Queue Name | Description |
|-------------|-------|-----|------------|-------------|
| Level 1 | 10 seconds | 10,000ms | `q.{service}.retry.{event}.1` | First retry attempt |
| Level 2 | 1 minute | 60,000ms | `q.{service}.retry.{event}.2` | Second retry attempt |
| Level 3 | 5 minutes | 300,000ms | `q.{service}.retry.{event}.3` | Final retry attempt |
| Exhausted | N/A | N/A | `q.{service}.dlq.{event}` | Dead Letter Queue |

### 2.2 Error-Specific Retry Policies

#### 2.2.1 Network Errors

| Error Code | Description | Max Retries | Backoff Strategy | Action on Failure |
|------------|-------------|-------------|------------------|-------------------|
| `NET_TIMEOUT` | Request timeout | 3 | Exponential (10s, 60s, 5m) | DLQ |
| `NET_DNS_ERROR` | DNS resolution failure | 3 | Exponential (10s, 60s, 5m) | DLQ |
| `NET_CONNECTION_REFUSED` | Connection refused | 5 | Exponential (10s, 30s, 2m, 10m, 30m) | DLQ |
| `NET_RATE_LIMITED` | Rate limit exceeded | 5 | Linear + jitter (60s increments) | DLQ |

#### 2.2.2 Database Errors

| Error Code | Description | Max Retries | Backoff Strategy | Action on Failure |
|------------|-------------|-------------|------------------|-------------------|
| `DB_CONNECTION_ERROR` | Cannot connect to database | 5 | Exponential (10s, 30s, 2m, 10m, 30m) | DLQ |
| `DB_DEADLOCK` | Transaction deadlock | 3 | Linear (1s, 2s, 5s) | DLQ |
| `DB_TIMEOUT` | Query timeout | 3 | Exponential (10s, 30s, 2m) | DLQ |
| `DB_CONSTRAINT_VIOLATION` | Unique constraint violation | 0 | No retry | Immediate DLQ |
| `DB_FOREIGN_KEY_ERROR` | Foreign key constraint violation | 0 | No retry | Immediate DLQ |

#### 2.2.3 External Service Errors

| Error Code | Description | Max Retries | Backoff Strategy | Action on Failure |
|------------|-------------|-------------|------------------|-------------------|
| `EXT_SERVICE_UNAVAILABLE` | Service unavailable (503) | 5 | Exponential (30s, 2m, 10m, 30m, 1h) | DLQ |
| `EXT_BAD_GATEWAY` | Bad gateway (502) | 3 | Exponential (10s, 30s, 2m) | DLQ |
| `EXT_GATEWAY_TIMEOUT` | Gateway timeout (504) | 3 | Exponential (30s, 2m, 10m) | DLQ |
| `EXT_CLIENT_ERROR` | Client error (4xx) | 0 | No retry | Immediate DLQ |
| `EXT_TIMEOUT` | External service timeout | 3 | Exponential (10s, 60s, 5m) | DLQ |

#### 2.2.4 Validation Errors

| Error Code | Description | Max Retries | Backoff Strategy | Action on Failure |
|------------|-------------|-------------|------------------|-------------------|
| `VAL_SCHEMA_INVALID` | JSON schema validation failed | 0 | No retry | Immediate DLQ |
| `VAL_MISSING_REQUIRED` | Missing required field | 0 | No retry | Immediate DLQ |
| `VAL_TYPE_MISMATCH` | Type mismatch in payload | 0 | No retry | Immediate DLQ |
| `VAL_ENUM_INVALID` | Invalid enum value | 0 | No retry | Immediate DLQ |
| `VAL_FORMAT_INVALID` | Invalid format (email, UUID, etc.) | 0 | No retry | Immediate DLQ |

#### 2.2.5 Business Logic Errors

| Error Code | Description | Max Retries | Backoff Strategy | Action on Failure |
|------------|-------------|-------------|------------------|-------------------|
| `BIZ_DUPLICATE_EVENT` | Duplicate event detected | 0 | No retry | Ack (drop) |
| `BIZ_STALE_EVENT` | Event too old to process | 0 | No retry | Ack (drop) |
| `BIZ_STATE_TRANSITION` | Invalid state transition | 0 | No retry | DLQ |
| `BIZ_PERMISSION_DENIED` | Insufficient permissions | 0 | No retry | DLQ |
| `BIZ_QUOTA_EXCEEDED` | Resource quota exceeded | 0 | No retry | DLQ |

### 2.3 Event Type Specific Retry Policies

| Event Type | Priority | Max Retries | TTL Strategy | DLQ Retention |
|------------|----------|-------------|--------------|----------------|
| `order.created` | Critical | 5 | 10s, 30s, 2m, 10m, 30m | 30 days |
| `order.cancelled` | Critical | 5 | 10s, 30s, 2m, 10m, 30m | 30 days |
| `credit.changed` | Critical | 5 | 10s, 30s, 2m, 10m, 30m | 30 days |
| `stock.changed` | Critical | 5 | 10s, 30s, 2m, 10m, 30m | 30 days |
| `price.changed` | High | 3 | 10s, 60s, 5m | 7 days |
| `product.updated` | Normal | 3 | 10s, 60s, 5m | 7 days |
| `cart.updated` | Low | 2 | 30s, 5m | 1 day |
| `notification.sent` | Low | 3 | 10s, 60s, 5m | 1 day |

### 2.4 Backoff Formula

The backoff delay is calculated using the following formula with jitter to prevent thundering herd:

```javascript
/**
 * Calculates retry delay with jitter
 * @param attempt - Retry attempt number (1-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.5 * exponentialDelay; // 50% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

// Example values for standard retry strategy
const standardBackoff = [
  calculateBackoff(1, 10000, 60000),   // ~10s
  calculateBackoff(2, 10000, 60000),   // ~20s
  calculateBackoff(3, 10000, 60000),   // ~40s
];
```

---

## 3. Poison Message Handling

### 3.1 Poison Message Definition

A **poison message** is a message that causes a consumer to repeatedly fail, creating a loop where the message is never successfully processed and continues to cause failures or resource consumption.

### 3.2 Poison Message Indicators

A message is considered poisonous when it meets ANY of the following criteria:

| Indicator | Threshold | Description |
|-----------|-----------|-------------|
| **Consecutive Failures** | > 3 | Message fails processing 3+ consecutive times |
| **Processing Time Exceeded** | > 5 minutes | Message takes longer than 5 minutes to process |
| **Consumer Crash** | 1 | Message causes consumer process to crash |
| **Exception Pattern** | Recognized | Error matches known poison pattern (e.g., infinite recursion) |
| **Resource Exhaustion** | Detected | Message causes memory/CPU spike in consumer |
| **Schema Mismatch** | Detected | Payload cannot be validated against any schema |

### 3.3 Poison Message Detection Algorithm

```typescript
/**
 * Poison message detector
 */
interface PoisonMessageDetector {
  /**
   * Detects if a message is poisonous based on failure history
   */
  isPoisonous(message: EventEnvelope, history: FailureHistory): boolean {
    // Rule 1: Consecutive failures
    if (history.consecutiveFailures >= this.maxConsecutiveFailures) {
      return true;
    }

    // Rule 2: Total failures exceeding threshold
    if (history.totalFailures >= this.maxTotalFailures) {
      return true;
    }

    // Rule 3: Different error types (indicates systemic issue)
    if (history.uniqueErrorTypes >= this.maxUniqueErrors) {
      return true;
    }

    // Rule 4: Age-based poisoning (old messages are likely stale)
    if (this.getAge(message) > this.maxMessageAge) {
      return true;
    }

    // Rule 5: Known poison patterns
    if (this.matchesPoisonPattern(message, history)) {
      return true;
    }

    return false;
  }

  private maxConsecutiveFailures = 3;
  private maxTotalFailures = 5;
  private maxUniqueErrors = 3;
  private maxMessageAge = 86400000; // 24 hours
}
```

### 3.4 Poison Message Quarantine Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        POISON MESSAGE QUARANTINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. DETECTION                                                               │
│     ├── Monitor failure patterns per message ID                               │
│     ├── Track consecutive failures                                           │
│     ├── Detect resource anomalies                                             │
│     └── Identify exception patterns                                          │
│                                                                             │
│  2. ISOLATION                                                               │
│     ├── Move message to poison queue immediately                             │
│     ├── Stop all retries for this message                                    │
│     ├── Remove from main processing pipeline                                 │
│     └── Tag with quarantine metadata                                         │
│                                                                             │
│  3. ANALYSIS                                                                │
│     ├── Extract error details and stack trace                                │
│     ├── Capture consumer state and environment                               │
│     ├── Analyze payload for anomalies                                       │
│     └── Generate poison report                                               │
│                                                                             │
│  4. NOTIFICATION                                                             │
│     ├── Send alert to on-call team                                          │
│     ├── Create incident in monitoring system                                 │
│     ├── Log to poison message registry                                      │
│     └── Update metrics and dashboards                                        │
│                                                                             │
│  5. RECOVERY (Manual)                                                       │
│     ├── Investigate root cause                                               │
│     ├── Fix underlying issue (code, data, config)                            │
│     ├── Decide: retry, modify, or discard                                    │
│     └── Document outcome and lessons learned                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Poison Queue Structure

```json
{
  "poison_message": {
    "original_message": {
      "event_id": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "order.created",
      "event_version": "v1",
      "occurred_at": "2026-02-13T10:00:00.000Z",
      "payload": { /* original payload */ }
    },
    "quarantine_info": {
      "quarantined_at": "2026-02-13T10:15:30.123Z",
      "quarantine_reason": "consecutive_failures_exceeded",
      "quarantine_source": "notification-worker",
      "detection_method": "automatic"
    },
    "failure_history": {
      "total_attempts": 4,
      "consecutive_failures": 4,
      "failure_details": [
        {
          "attempt": 1,
          "timestamp": "2026-02-13T10:05:00.000Z",
          "error_code": "EXT_SERVICE_UNAVAILABLE",
          "error_message": "SMTP service unavailable",
          "retry_queue": "retry.order.created.1"
        },
        {
          "attempt": 2,
          "timestamp": "2026-02-13T10:06:10.000Z",
          "error_code": "EXT_SERVICE_UNAVAILABLE",
          "error_message": "SMTP service unavailable",
          "retry_queue": "retry.order.created.2"
        }
      ]
    },
    "analysis": {
      "error_pattern": "service_down",
      "recoverable": true,
      "suggested_action": "retry_after_service_restore"
    }
  }
}
```

### 3.6 Poison Message Registry

All poison messages are registered in a tracking system for analysis and reporting:

| Field | Type | Description |
|-------|------|-------------|
| `poison_id` | UUID | Unique identifier for poison entry |
| `original_event_id` | UUID | Original event message ID |
| `quarantine_timestamp` | ISO8601 | When message was quarantined |
| `event_type` | string | Type of event |
| `producer` | string | Service that produced event |
| `consumer` | string | Consumer that detected poison |
| `quarantine_reason` | enum | Reason for quarantine |
| `failure_count` | number | Total failure attempts |
| `status` | enum | pending, investigating, resolved, discarded |
| `assigned_to` | string | Engineer assigned to investigate |
| `resolution` | string | Resolution notes |
| `resolved_at` | ISO8601 | When issue was resolved |

### 3.7 Poison Message Recovery Actions

| Action | When to Use | Process |
|--------|-------------|---------|
| **Retry** | Issue resolved by code/config fix | Move message back to main queue with new routing key |
| **Modify** | Payload has fixable data issue | Apply transformation, then retry |
| **Discard** | Message is invalid or irrelevant | Log and delete with documentation |
| **Bypass** | Message requires manual handling | Remove from queue, process manually |

---

## 4. DLQ Monitoring and Alerting

### 4.1 Dead Letter Queue Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DLQ MONITORING LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │  Main Queue  │───▶│  Retry Q1    │───▶│  Retry Q2    │                │
│  └──────────────┘    └──────────────┘    └──────────────┘                │
│         │                  │                  │                              │
│         │ (DLX)           │ (TTL expire)      │ (TTL expire)                │
│         ▼                  ▼                  ▼                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │            Dead Letter Exchange (DLX)                │                   │
│  └───────────────────────────┬──────────────────────┘                   │
│                              │                                              │
│                              │ (x-dead-letter-routing-key)                  │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │              Dead Letter Queue (DLQ)                │                   │
│  └───────────────────────────┬──────────────────────┘                   │
│                              │                                              │
│          ┌───────────────────┼───────────────────┐                       │
│          ▼                   ▼                   ▼                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                │
│  │   Metrics    │    │   Alerts     │    │   Dashboard  │                │
│  │  Collector   │    │  Generator   │    │   Display    │                │
│  └──────────────┘    └──────────────┘    └──────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 DLQ Metrics

| Metric | Type | Description | Collection Interval |
|--------|------|-------------|-------------------|
| `dlq_message_count` | Gauge | Number of messages in DLQ | 30s |
| `dlq_message_rate` | Counter | Rate of messages entering DLQ | 30s |
| `dlq_message_age` | Histogram | Age of messages in DLQ | 30s |
| `dlq_by_event_type` | Gauge | DLQ count by event type | 30s |
| `dlq_by_error_code` | Gauge | DLQ count by error code | 30s |
| `dlq_by_producer` | Gauge | DLQ count by producer | 30s |
| `dlq_recovery_rate` | Counter | Rate of messages recovered from DLQ | 30s |
| `dlq_discard_rate` | Counter | Rate of messages discarded from DLQ | 30s |
| `dlq_time_to_resolution` | Histogram | Time from DLQ entry to resolution | 30s |

### 4.3 Alert Rules

#### 4.3.1 DLQ Presence Alert

```yaml
alert: RabbitMQDLQMessagesPresent
expr: rabbitmq_queue_messages{queue=~".*\\.dlq\\..*"} > 0
for: 1m
labels:
  severity: warning
  service: rabbitmq
annotations:
  summary: "Messages detected in DLQ: {{ $labels.queue }}"
  description: "DLQ {{ $labels.queue }} has {{ $value }} messages. Immediate investigation required."
  runbook_url: "https://docs.cypher.ro/error-policy#dlq-handling"
```

#### 4.3.2 High DLQ Count Alert

```yaml
alert: RabbitMQDLQHighCount
expr: rabbitmq_queue_messages{queue=~".*\\.dlq\\..*"} > 100
for: 5m
labels:
  severity: critical
  service: rabbitmq
annotations:
  summary: "Critical DLQ message count: {{ $labels.queue }}"
  description: "DLQ {{ $labels.queue }} has {{ $value }} messages exceeding threshold. Immediate action required."
  runbook_url: "https://docs.cypher.ro/error-policy#dlq-handling"
```

#### 4.3.3 DLQ Age Alert

```yaml
alert: RabbitMQDLQStaleMessages
expr: rabbitmq_queue_messages_ready{queue=~".*\\.dlq\\..*"} > 10
for: 1h
labels:
  severity: warning
  service: rabbitmq
annotations:
  summary: "Stale messages in DLQ: {{ $labels.queue }}"
  description: "DLQ {{ $labels.queue }} has messages older than 1 hour. Review for manual processing."
  runbook_url: "https://docs.cypher.ro/error-policy#dlq-handling"
```

#### 4.3.4 Poison Message Rate Alert

```yaml
alert: RabbitMQPoisonMessageRateHigh
expr: rate(dlq_poison_messages_total[5m]) > 5
for: 5m
labels:
  severity: critical
  service: rabbitmq
annotations:
  summary: "High poison message rate detected"
  description: "{{ $value }} poison messages per minute detected. Possible systemic issue."
  runbook_url: "https://docs.cypher.ro/error-policy#poison-handling"
```

### 4.4 Dashboard Configuration

| Dashboard Panel | Metric | Visualization | Threshold |
|----------------|--------|----------------|-----------|
| DLQ Message Count | `dlq_message_count` | Gauge | < 10 (green), 10-50 (yellow), > 50 (red) |
| DLQ Entry Rate | `dlq_message_rate` | Time series graph | Trend monitoring |
| DLQ by Event Type | `dlq_by_event_type` | Pie chart | Distribution view |
| DLQ by Error Code | `dlq_by_error_code` | Bar chart | Error pattern analysis |
| DLQ Recovery Rate | `dlq_recovery_rate` | Time series graph | Recovery effectiveness |
| Average Resolution Time | `dlq_time_to_resolution` | Histogram | Process efficiency |
| Poison Message Count | `poison_message_count` | Gauge | Trend monitoring |

### 4.5 Notification Channels

| Alert Severity | Channels | Escalation |
|----------------|----------|------------|
| **Info** | Slack channel #events-dlq | None |
| **Warning** | Slack channel #events-dlq, Email on-call | None |
| **Critical** | Slack channel #events-critical, Email on-call, SMS, PagerDuty | 15min no ack |
| **Emergency** | All channels, Phone call | Immediate |

---

## 5. Recovery Procedures

### 5.1 Recovery Decision Framework

```
                     DLQ MESSAGE DETECTED
                               │
                ┌──────────────┼──────────────┐
                │                              │
         Automatic Analysis               Manual Review Required
                │                              │
       ┌────────┴────────┐              ┌───────┴───────┐
       │                 │              │               │
   Recoverable    Not Recoverable    Investigate    Escalate
       │                 │              │               │
       ▼                 ▼              ▼               ▼
   Auto-Retry         Discard       Manual Fix     Incident
       │                 │              │               │
       └────────┬────────┘              └───────┬───────┘
                │                              │
                └──────────────┬───────────────┘
                               │
                        Document Outcome
                               │
                        Update Registry
```

### 5.2 Automatic Recovery Procedures

#### 5.2.1 Transient Error Recovery

```typescript
/**
 * Automatic recovery for transient errors
 */
class TransientErrorRecovery {
  async recover(message: EventEnvelope, error: TransientError): Promise<RecoveryAction> {
    // Check if underlying issue is resolved
    const isResolved = await this.checkServiceHealth(error.service);

    if (isResolved) {
      return {
        action: 'retry',
        targetQueue: 'main',
        delay: 0,
        metadata: {
          recovery_type: 'automatic_transient',
          original_error: error.code
        }
      };
    }

    return {
      action: 'quarantine',
      targetQueue: 'dlq',
      reason: 'service_still_unhealthy'
    };
  }

  private async checkServiceHealth(service: string): Promise<boolean> {
    // Implement health check for the service
    // Return true if service is healthy
  }
}
```

#### 5.2.2 Idempotency-Based Recovery

```typescript
/**
 * Recovery for idempotent operations that may have succeeded despite error
 */
class IdempotencyRecovery {
  async recover(message: EventEnvelope, error: Error): Promise<RecoveryAction> {
    const eventProcessor = message.event_type.split('.')[0];

    // Check if operation was actually successful
    const wasSuccessful = await this.checkOperationSuccess(
      eventProcessor,
      message.payload
    );

    if (wasSuccessful) {
      // Operation succeeded despite error - just acknowledge
      return {
        action: 'ack',
        reason: 'idempotent_check_passed'
      };
    }

    // Retry the operation
    return {
      action: 'retry',
      targetQueue: 'main',
      metadata: {
        recovery_type: 'idempotent_retry'
      }
    };
  }

  private async checkOperationSuccess(
    processor: string,
    payload: any
  ): Promise<boolean> {
    // Check database, external systems, etc. to verify if operation succeeded
  }
}
```

### 5.3 Manual Recovery Procedures

#### 5.3.1 Message Investigation Checklist

- [ ] Review message payload for anomalies
- [ ] Check error stack trace and message
- [ ] Verify all referenced entities exist
- [ ] Check data consistency across systems
- [ ] Review consumer logs at time of failure
- [ ] Check system health at time of failure
- [ ] Verify configuration at time of failure
- [ ] Check for related incidents

#### 5.3.2 Manual Recovery Commands

```bash
# View messages in DLQ
rabbitmqctl list_queues name messages consumers

# Get messages from specific DLQ
rabbitmqadmin get queue=cypher.dlq.order.created

# Move message back to main queue for retry
rabbitmqadmin publish exchange=cypher.events \
  routing_key=order.created \
  payload='<message_payload>' \
  headers='{"x-retry-count": 4}'

# Discard message (acknowledge without processing)
rabbitmqadmin purge queue=cypher.dlq.order.created

# Move message to DLQ with annotation
rabbitmqadmin publish exchange=cypher.dlq \
  routing_key=order.created \
  payload='<modified_message_payload>' \
  headers='{"x-manual-intervention": true, "x-intervention-reason": "data-fix-applied"}'
```

#### 5.3.3 Recovery Script Template

```typescript
/**
 * Manual recovery script template
 */
import { RabbitMQClient } from './rabbitmq-client';
import { Logger } from './logger';

async function manualRecovery(options: RecoveryOptions) {
  const logger = new Logger('ManualRecovery');
  const rabbitmq = new RabbitMQClient();

  try {
    // 1. Get message from DLQ
    const message = await rabbitmq.getMessage(options.dlqQueue);
    logger.info(`Retrieved message: ${message.event_id}`);

    // 2. Analyze message
    const analysis = await analyzeMessage(message);
    logger.info(`Analysis: ${JSON.stringify(analysis)}`);

    // 3. Apply fixes if needed
    if (options.applyFixes) {
      const fixedMessage = await applyFixes(message, analysis);
      logger.info(`Fixes applied`);
    }

    // 4. Decide recovery action
    switch (options.action) {
      case 'retry':
        await rabbitmq.publish(
          'cypher.events',
          message.event_type,
          message
        );
        logger.info(`Message sent for retry`);
        break;

      case 'discard':
        await rabbitmq.ack(options.dlqQueue, message.deliveryTag);
        logger.info(`Message discarded`);
        break;

      case 'modify':
        const modified = options.modifier(message);
        await rabbitmq.publish(
          'cypher.events',
          message.event_type,
          modified
        );
        logger.info(`Modified message sent for processing`);
        break;
    }

    // 5. Update poison registry
    await updatePoisonRegistry(message.event_id, {
      status: 'resolved',
      action: options.action,
      resolved_at: new Date().toISOString(),
      resolved_by: options.user
    });

    logger.info(`Recovery completed successfully`);
  } catch (error) {
    logger.error(`Recovery failed: ${error.message}`);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  manualRecovery({
    dlqQueue: 'cypher.dlq.order.created',
    messageId: '550e8400-e29b-41d4-a716-446655440000',
    action: 'retry',
    applyFixes: false,
    user: 'engineer@cypher.ro'
  });
}
```

### 5.4 Recovery SLAs

| Priority | Target Resolution Time | Max Time in DLQ |
|----------|----------------------|-----------------|
| **P0 - Critical** | 15 minutes | 1 hour |
| **P1 - High** | 1 hour | 4 hours |
| **P2 - Medium** | 4 hours | 24 hours |
| **P3 - Low** | 24 hours | 7 days |

### 5.5 Recovery Post-Mortem

After recovering from a DLQ incident, complete a post-mortem:

```markdown
# DLQ Incident Post-Mortem

## Incident Summary
- **DLQ Queue**: cypher.dlq.order.created
- **Message Count**: 127
- **Detection Time**: 2026-02-13T10:00:00Z
- **Resolution Time**: 2026-02-13T11:30:00Z
- **Duration**: 1h 30m

## Root Cause
- [ ] Code bug
- [ ] Configuration error
- [ ] Data inconsistency
- [ ] External service failure
- [ ] Other: _______________

## Recovery Actions
1. Fixed code/config: _______________
2. Modified data: _______________
3. Other actions: _______________

## Impact
- Messages lost: ____
- Messages retried successfully: ____
- Business impact: _______________

## Prevention
- Changes made to prevent recurrence: _______________
- Monitoring improvements: _______________
- Process improvements: _______________

## Lessons Learned
1. _______________
2. _______________
3. _______________
```

---

## 6. Error Categories

### 6.1 Category Definitions

#### 6.1.1 Transient Errors (RETRYABLE)

These errors are temporary and typically resolve themselves. They should be retried with backoff.

| Subcategory | Examples | HTTP Codes | Retry Strategy |
|-------------|----------|------------|----------------|
| **Network** | Timeout, connection refused, DNS failure | 502, 503, 504 | Exponential backoff |
| **Rate Limit** | Too many requests | 429 | Linear backoff |
| **Resource** | Database connection pool exhausted, disk full | 503 | Exponential backoff |
| **Service** | Service temporarily unavailable | 503 | Exponential backoff |

#### 6.1.2 Recoverable Errors (LIMITED_RETRY)

These errors may resolve but have a lower probability of success on retry. Limited retries are appropriate.

| Subcategory | Examples | HTTP Codes | Retry Strategy |
|-------------|----------|------------|----------------|
| **Business Logic** | State transition error, quota exceeded | 400, 409 | Limited retry (3x max) |
| **External Service** | Third-party API error with unknown cause | 500, 502 | Limited retry (3x max) |
| **Data Consistency** | Stale data, optimistic lock failure | 409 | Limited retry (3x max) |

#### 6.1.3 Permanent Errors (NO_RETRY)

These errors will not resolve through retrying. The message should go to DLQ immediately.

| Subcategory | Examples | HTTP Codes | Action |
|-------------|----------|------------|--------|
| **Schema** | Invalid JSON, missing required fields, type mismatch | 400 | Immediate DLQ |
| **Validation** | Invalid email, invalid UUID, enum value | 400 | Immediate DLQ |
| **Reference** | Foreign key not found, invalid ID | 404 | Immediate DLQ |
| **Permission** | Access denied, unauthorized | 401, 403 | Immediate DLQ |
| **Configuration** | Missing config, invalid configuration | N/A | Immediate DLQ |

#### 6.1.4 Critical Errors (ESCALATE)

These errors indicate serious system issues that require immediate attention.

| Subcategory | Examples | HTTP Codes | Action |
|-------------|----------|------------|--------|
| **Poison Message** | Message causing repeated failures | N/A | Quarantine + Alert |
| **Data Corruption** | Inconsistent state, integrity violation | N/A | Quarantine + Critical Alert |
| **Security** | Injection attempt, authentication bypass | N/A | Quarantine + Critical Alert |
| **System** | Out of memory, CPU 100%, disk full | N/A | Critical Alert |

### 6.2 Error Category Mapping

| Error Code | Category | Description | Default Action |
|------------|----------|-------------|----------------|
| `NET_*` | Transient | All network errors | Retry with backoff |
| `DB_CONNECTION_ERROR` | Transient | Database connection issues | Retry with backoff |
| `DB_DEADLOCK` | Transient | Transaction deadlock | Retry linear |
| `DB_CONSTRAINT_VIOLATION` | Permanent | Constraint violations | Immediate DLQ |
| `DB_FOREIGN_KEY_ERROR` | Permanent | Foreign key errors | Immediate DLQ |
| `EXT_SERVICE_UNAVAILABLE` | Transient | Service unavailable | Retry with backoff |
| `EXT_TIMEOUT` | Transient | External timeout | Retry with backoff |
| `EXT_CLIENT_ERROR` | Permanent | 4xx errors | Immediate DLQ |
| `VAL_*` | Permanent | All validation errors | Immediate DLQ |
| `BIZ_DUPLICATE_EVENT` | Permanent | Duplicate event | Ack (drop) |
| `BIZ_STALE_EVENT` | Permanent | Event too old | Ack (drop) |
| `BIZ_PERMISSION_DENIED` | Permanent | Permission error | Immediate DLQ |
| `POISON_MESSAGE` | Critical | Poison message detected | Quarantine + Critical Alert |

### 6.3 Error Severity Levels

| Severity | Description | Response Time | Notification |
|----------|-------------|---------------|--------------|
| **P0 - Critical** | System down, data loss, security breach | 5 minutes | Phone, SMS, PagerDuty |
| **P1 - High** | Significant business impact, degraded service | 15 minutes | Slack critical, Email, SMS |
| **P2 - Medium** | Minor business impact, partial degradation | 1 hour | Slack warning, Email |
| **P3 - Low** | Informational, no business impact | 24 hours | Slack info |
| **P4 - Debug** | Debug information only | N/A | Logs only |

---

## 7. Error Response Codes

### 7.1 Error Code Format

```
Format: {CATEGORY}_{SPECIFIC_ERROR}
Example: NET_TIMEOUT, VAL_SCHEMA_INVALID
```

### 7.2 Network Error Codes

| Code | Description | HTTP | Retry | Message |
|------|-------------|------|-------|---------|
| `NET_TIMEOUT` | Request timeout | 504 | Yes | Request exceeded timeout threshold |
| `NET_DNS_ERROR` | DNS resolution failure | N/A | Yes | Could not resolve hostname |
| `NET_CONNECTION_REFUSED` | Connection refused | 502 | Yes | Target refused connection |
| `NET_CONNECTION_RESET` | Connection reset by peer | N/A | Yes | Connection was reset |
| `NET_RATE_LIMITED` | Rate limit exceeded | 429 | Yes | Too many requests |
| `NET_SOCKET_ERROR` | Socket error | N/A | Yes | Low-level socket error |
| `NET_TLS_ERROR` | TLS/SSL error | N/A | No | Certificate or handshake error |
| `NET_PROXY_ERROR` | Proxy error | 502 | Yes | Proxy connection failed |

### 7.3 Database Error Codes

| Code | Description | HTTP | Retry | Message |
|------|-------------|------|-------|---------|
| `DB_CONNECTION_ERROR` | Cannot connect to database | 503 | Yes | Database connection failed |
| `DB_TIMEOUT` | Query timeout | 504 | Yes | Query execution timed out |
| `DB_DEADLOCK` | Transaction deadlock | 409 | Yes | Transaction deadlock detected |
| `DB_CONSTRAINT_VIOLATION` | Constraint violation | 400 | No | Constraint violation |
| `DB_FOREIGN_KEY_ERROR` | Foreign key constraint | 400 | No | Referenced entity not found |
| `DB_UNIQUE_VIOLATION` | Unique constraint violation | 409 | No | Duplicate key violation |
| `DB_CHECK_VIOLATION` | Check constraint violation | 400 | No | Data validation failed |
| `DB_EXCLUSION_VIOLATION` | Exclusion constraint violation | 409 | No | Overlapping data |
| `DB_NOT_NULL_VIOLATION` | Not null violation | 400 | No | Required field is null |
| `DB_DATA_EXCEPTION` | Invalid data format | 400 | No | Data format is invalid |

### 7.4 External Service Error Codes

| Code | Description | HTTP | Retry | Message |
|------|-------------|------|-------|---------|
| `EXT_SERVICE_UNAVAILABLE` | Service unavailable (503) | 503 | Yes | External service is down |
| `EXT_BAD_GATEWAY` | Bad gateway (502) | 502 | Yes | Gateway error |
| `EXT_GATEWAY_TIMEOUT` | Gateway timeout (504) | 504 | Yes | Gateway timeout |
| `EXT_TIMEOUT` | External service timeout | N/A | Yes | Request to external service timed out |
| `EXT_INVALID_RESPONSE` | Invalid response format | 502 | No | Could not parse response |
| `EXT_AUTH_ERROR` | Authentication error | 401 | No | Authentication failed |
| `EXT_RATE_LIMITED` | External rate limit | 429 | Yes | External rate limit exceeded |
| `EXT_CLIENT_ERROR` | Client error (4xx) | 400 | No | Client sent invalid request |
| `EXT_SERVER_ERROR` | Server error (5xx) | 500 | Yes | External server error |
| `EXT_UNKNOWN_ERROR` | Unknown error | N/A | Yes | Unknown error from external service |

### 7.5 Validation Error Codes

| Code | Description | HTTP | Retry | Message |
|------|-------------|------|-------|---------|
| `VAL_SCHEMA_INVALID` | JSON schema validation failed | 400 | No | Payload does not match schema |
| `VAL_MISSING_REQUIRED` | Missing required field | 400 | No | Required field is missing |
| `VAL_TYPE_MISMATCH` | Type mismatch in payload | 400 | No | Field has wrong type |
| `VAL_ENUM_INVALID` | Invalid enum value | 400 | No | Invalid enum value |
| `VAL_FORMAT_INVALID` | Invalid format | 400 | No | Invalid format (email, UUID, etc.) |
| `VAL_RANGE_INVALID` | Value out of range | 400 | No | Value outside allowed range |
| `VAL_PATTERN_INVALID` | Pattern mismatch | 400 | No | Value does not match pattern |
| `VAL_LENGTH_INVALID` | Invalid length | 400 | No | String length invalid |
| `VAL_ARRAY_INVALID` | Invalid array | 400 | No | Array validation failed |
| `VAL_OBJECT_INVALID` | Invalid object | 400 | No | Object validation failed |

### 7.6 Business Logic Error Codes

| Code | Description | HTTP | Retry | Message |
|------|-------------|------|-------|---------|
| `BIZ_DUPLICATE_EVENT` | Duplicate event detected | 409 | No | Event already processed |
| `BIZ_STALE_EVENT` | Event too old to process | 400 | No | Event timestamp is too old |
| `BIZ_STATE_TRANSITION` | Invalid state transition | 400 | No | Invalid state transition |
| `BIZ_PERMISSION_DENIED` | Insufficient permissions | 403 | No | Permission denied |
| `BIZ_QUOTA_EXCEEDED` | Resource quota exceeded | 429 | No | Quota exceeded |
| `BIZ_ENTITY_NOT_FOUND` | Entity not found | 404 | No | Entity does not exist |
| `BIZ_ENTITY_ALREADY_EXISTS` | Entity already exists | 409 | No | Entity already exists |
| `BIZ_INVALID_OPERATION` | Invalid operation | 400 | No | Operation not allowed |
| `BIZ_CONFLICT` | Business logic conflict | 409 | No | Conflict with business rules |
| `BIZ_CONDITION_FAILED` | Precondition failed | 412 | No | Precondition not met |

### 7.7 Critical Error Codes

| Code | Description | HTTP | Retry | Message |
|------|-------------|------|-------|---------|
| `POISON_MESSAGE` | Poison message detected | N/A | No | Message causing failures |
| `POISON_PATTERN` | Known poison pattern | N/A | No | Matches known poison pattern |
| `CORRUPTION_DETECTED` | Data corruption detected | N/A | No | Data integrity issue |
| `SECURITY_VIOLATION` | Security violation | N/A | No | Potential security issue |
| `INJECTION_ATTEMPT` | Injection attempt detected | N/A | No | SQL/NoSQL/Code injection |
| `AUTH_BYPASS_ATTEMPT` | Authentication bypass | N/A | No | Potential auth bypass |
| `RESOURCE_EXHAUSTION` | Resource exhausted | N/A | No | Memory/CPU/disk full |
| `SYSTEM_FAILURE` | System failure | N/A | No | Critical system failure |

### 7.8 Error Response Format

```json
{
  "error": {
    "code": "NET_TIMEOUT",
    "message": "Request to external service exceeded timeout threshold",
    "category": "transient",
    "severity": "warning",
    "retryable": true,
    "max_retries": 3,
    "retry_after": 10000,
    "details": {
      "service": "payment-gateway",
      "timeout_ms": 30000,
      "attempt": 1,
      "max_attempts": 3
    },
    "correlation_id": "660e8400-e29b-41d4-a716-446655440001",
    "timestamp": "2026-02-13T10:00:00.000Z"
  }
}
```

---

## 8. Best Practices

### 8.1 Error Handling Best Practices

#### 8.1.1 Consumer Error Handling

```typescript
/**
 * Recommended error handling pattern for consumers
 */
class EventConsumer {
  async consume(message: EventEnvelope): Promise<void> {
    try {
      // 1. Validate message
      this.validate(message);

      // 2. Check for idempotency
      if (await this.isDuplicate(message)) {
        await this.acknowledge(message);
        return;
      }

      // 3. Process message
      await this.process(message);

      // 4. Mark as processed
      await this.markProcessed(message);

      // 5. Acknowledge success
      await this.acknowledge(message);

    } catch (error) {
      await this.handleError(message, error);
    }
  }

  private async handleError(message: EventEnvelope, error: Error): Promise<void> {
    const errorCategory = this.classifyError(error);
    const retryCount = this.getRetryCount(message);

    switch (errorCategory) {
      case ErrorCategory.TRANSIENT:
        if (retryCount < this.maxRetries) {
          await this.retryWithBackoff(message, retryCount);
        } else {
          await this.sendToDLQ(message, error);
        }
        break;

      case ErrorCategory.PERMANENT:
        await this.sendToDLQ(message, error);
        break;

      case ErrorCategory.CRITICAL:
        await this.quarantineMessage(message, error);
        await this.alertTeam(message, error);
        break;
    }
  }
}
```

#### 8.1.2 Idempotency Best Practices

```typescript
/**
 * Idempotency handling
 */
class IdempotentProcessor {
  async process(message: EventEnvelope): Promise<void> {
    const eventId = message.event_id;

    // Check if already processed
    const processed = await this.isProcessed(eventId);
    if (processed) {
      this.logger.info(`Event ${eventId} already processed, skipping`);
      return;
    }

    try {
      // Use transaction to ensure atomicity
      await this.transaction(async (trx) => {
        // 1. Mark as processing (prevents duplicate processing in parallel)
        await trx.insert('processed_events', {
          event_id: eventId,
          status: 'processing',
          started_at: new Date()
        });

        // 2. Process the event
        await this.doProcess(message, trx);

        // 3. Mark as complete
        await trx.update('processed_events')
          .set({ status: 'completed', completed_at: new Date() })
          .where('event_id', eventId);
      });

    } catch (error) {
      // If processing failed, clean up
      await this.deleteProcessedEvent(eventId);
      throw error;
    }
  }
}
```

#### 8.1.3 Backoff Implementation

```typescript
/**
 * Exponential backoff with jitter
 */
class BackoffStrategy {
  async retry<T>(
    fn: () => Promise<T>,
    options: BackoffOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 60000,
      jitter = 0.5
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          throw error;
        }

        // Calculate delay with jitter
        const delay = this.calculateDelay(attempt, baseDelay, maxDelay, jitter);

        this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    jitter: number
  ): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitterAmount = exponentialDelay * jitter * (Math.random() - 0.5);
    const delay = exponentialDelay + jitterAmount;
    return Math.min(delay, maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 8.2 Monitoring Best Practices

#### 8.2.1 Error Metrics

```typescript
/**
 * Error metrics tracking
 */
class ErrorMetrics {
  private metrics = {
    errors_total: new Counter(),
    errors_by_code: new Counter({ labelNames: ['code'] }),
    errors_by_category: new Counter({ labelNames: ['category'] }),
    errors_by_severity: new Counter({ labelNames: ['severity'] }),
    dlq_messages: new Gauge({ labelNames: ['queue', 'event_type'] }),
    retry_attempts: new Counter({ labelNames: ['event_type', 'attempt'] }),
    poison_messages: new Counter({ labelNames: ['reason'] }),
  };

  recordError(error: ClassifiedError): void {
    this.metrics.errors_total.inc();
    this.metrics.errors_by_code.inc({ code: error.code });
    this.metrics.errors_by_category.inc({ category: error.category });
    this.metrics.errors_by_severity.inc({ severity: error.severity });
  }

  recordDLQMessage(queue: string, eventType: string): void {
    this.metrics.dlq_messages.inc({ queue, event_type: eventType });
  }

  recordRetry(eventType: string, attempt: number): void {
    this.metrics.retry_attempts.inc({ event_type: eventType, attempt: attempt.toString() });
  }

  recordPoisonMessage(reason: string): void {
    this.metrics.poison_messages.inc({ reason });
  }
}
```

#### 8.2.2 Structured Logging

```typescript
/**
 * Structured error logging
 */
class ErrorLogger {
  logError(context: {
    message: EventEnvelope;
    error: Error;
    category: ErrorCategory;
    retryCount: number;
    action: string;
  }): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      event_id: context.message.event_id,
      event_type: context.message.event_type,
      error_code: this.getErrorCode(context.error),
      error_message: context.error.message,
      error_stack: context.error.stack,
      error_category: context.category,
      retry_count: context.retryCount,
      action_taken: context.action,
      correlation_id: context.message.correlation_id,
      trace_id: context.message.trace_id,
      producer: context.message.producer,
      consumer: process.env.SERVICE_NAME,
      environment: process.env.NODE_ENV,
    };

    this.logger.error(JSON.stringify(logEntry));
  }
}
```

### 8.3 Circuit Breaker Pattern

```typescript
/**
 * Circuit breaker for external service calls
 */
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private successCount = 0;

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private halfOpenMaxCalls: number = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;

    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.halfOpenMaxCalls) {
        this.state = 'closed';
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime.getTime() > this.timeout;
  }
}
```

### 8.4 Timeout Handling

```typescript
/**
 * Timeout wrapper for operations
 */
class TimeoutHandler {
  async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutError: Error = new Error('Operation timed out')
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(timeoutError), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  async executeWithProgressiveTimeout<T>(
    fn: () => Promise<T>,
    timeouts: number[] = [5000, 10000, 30000]
  ): Promise<T> {
    for (const timeout of timeouts) {
      try {
        return await this.withTimeout(fn(), timeout);
      } catch (error) {
        if (error.message === 'Operation timed out') {
          continue; // Try with next timeout
        }
        throw error;
      }
    }
    throw new Error('All timeout attempts failed');
  }
}
```

---

## 9. Troubleshooting Guide

### 9.1 Common Issues and Solutions

#### 9.1.1 Message Stuck in DLQ

**Symptoms:**
- Messages accumulating in DLQ
- No alerts being triggered
- High DLQ message count

**Possible Causes:**
1. Consumer not configured with DLQ
2. Retry exhausted but DLX not configured
3. Permission issues with DLX routing
4. Infinite retry loop

**Investigation Steps:**

```bash
# Check DLQ configuration
rabbitmqctl list_queues name messages consumers arguments

# Check DLX configuration
rabbitmqctl list_exchanges name type arguments

# Check queue bindings
rabbitmqctl list_bindings

# Check message details
rabbitmqadmin get queue=cypher.dlq.order.created count=1

# Check error logs
docker logs cypher-erp-app --tail 100 | grep -i "dlq\|error"
```

**Solutions:**

```bash
# Solution 1: Configure DLX on queue
rabbitmqctl set_policy DLX \
  "^cypher\..*" \
  '{"dead-letter-exchange":"cypher.dlq","dead-letter-routing-key":"#"}'

# Solution 2: Manually move messages
rabbitmqadmin publish exchange=cypher.events \
  routing_key=order.created \
  payload='<message_payload>'

# Solution 3: Clear stuck messages (with caution)
rabbitmqadmin purge queue=cypher.dlq.order.created
```

#### 9.1.2 Consumer Not Consuming Messages

**Symptoms:**
- Queue depth increasing
- No consumers listed
- Messages not being processed

**Investigation Steps:**

```bash
# Check consumer status
rabbitmqctl list_queues name consumers

# Check if consumer process is running
docker ps | grep consumer

# Check consumer logs
docker logs <consumer-container> --tail 100

# Check connection status
rabbitmqctl list_connections
```

**Solutions:**

```bash
# Restart consumer service
docker restart <consumer-container>

# Check network connectivity
docker exec <consumer-container> ping rabbitmq

# Verify consumer configuration
cat /app/config/consumer.json | grep -i rabbitmq
```

#### 9.1.3 High Retry Rate

**Symptoms:**
- Many messages in retry queues
- High error rate
- System performance degradation

**Investigation Steps:**

```bash
# Check retry queue depth
rabbitmqctl list_queues name messages | grep retry

# Check error logs
docker logs <consumer-container> --tail 500 | grep ERROR

# Identify most common errors
docker logs <consumer-container> --tail 1000 | grep ERROR | awk '{print $NF}' | sort | uniq -c

# Check external service health
curl -f http://external-service/health || echo "Service down"
```

**Solutions:**

```bash
# If transient issue: Wait for retries to complete

# If permanent issue: Check service health
# Temporarily pause consumer if needed
docker pause <consumer-container>

# Fix underlying issue
# Then resume processing
docker unpause <consumer-container>
```

#### 9.1.4 Poison Message Loop

**Symptoms:**
- Same message failing repeatedly
- Consumer crashes
- High CPU/memory usage

**Investigation Steps:**

```bash
# Identify problematic message
rabbitmqadmin get queue=cypher.retry.order.created.1 requeue=false

# Check for poison patterns
grep -r "poison" /var/log/

# Check system resources
top -p $(pgrep -f consumer)
```

**Solutions:**

```typescript
// Use poison message detection
const detector = new PoisonMessageDetector();
if (detector.isPoisonous(message, failureHistory)) {
  await quarantineMessage(message);
  await alertTeam(message);
}
```

#### 9.1.5 Out of Memory Issues

**Symptoms:**
- Container killed by OOM killer
- Frequent restarts
- High memory usage

**Investigation Steps:**

```bash
# Check memory usage
docker stats <container>

# Check memory limits
docker inspect <container> | grep -i memory

# Check for message backlog
rabbitmqctl list_queues name messages

# Check for large messages
rabbitmqadmin get queue=cypher.dlq.order.created | wc -c
```

**Solutions:**

```yaml
# Increase memory limits in docker-compose
services:
  consumer:
    mem_limit: 2g
    mem_reservation: 1g

# Or implement batch processing
batch_size: 100  # Process in batches
prefetch_count: 10  # Limit unacknowledged messages
```

### 9.2 Debug Commands Reference

```bash
# ============================================
# Queue Management
# ============================================

# List all queues with details
rabbitmqctl list_queues name messages consumers messages_unacknowledged

# List DLQ queues only
rabbitmqctl list_queues name messages | grep dlq

# List retry queues only
rabbitmqctl list_queues name messages | grep retry

# Purge a queue (CAUTION: deletes all messages)
rabbitmqadmin purge queue=cypher.dlq.order.created

# Delete a queue (CAUTION: deletes queue)
rabbitmqadmin delete queue name=cypher.dlq.order.created

# ============================================
# Message Operations
# ============================================

# Get message from queue (without ack)
rabbitmqadmin get queue=cypher.dlq.order.created requeue=false count=1

# Get message details as JSON
rabbitmqadmin get queue=cypher.dlq.order.created | jq '.'

# Publish message to exchange
rabbitmqadmin publish exchange=cypher.events \
  routing_key=order.created \
  payload='{"event_id":"..."}' \
  headers='{"x-retry-count": 1}'

# Move message between queues
rabbitmqadmin move source=cypher.dlq.order.created \
  destination=cypher.events

# ============================================
# Exchange and Bindings
# ============================================

# List all exchanges
rabbitmqctl list_exchanges name type

# List bindings for a queue
rabbitmqctl list_bindings queue name

# List bindings for an exchange
rabbitmqctl list_bindings exchange name

# Add a binding
rabbitmqadmin declare binding \
  source=cypher.events \
  destination=cypher.search-indexer.product-updated \
  routing_key=product.updated

# ============================================
# Connection and Channel Management
# ============================================

# List all connections
rabbitmqctl list_connections

# Close a specific connection
rabbitmqctl close_connection <connection_pid>

# List all channels
rabbitmqctl list_channels

# ============================================
# Policy Management
# ============================================

# List all policies
rabbitmqctl list_policies

# Set DLX policy
rabbitmqctl set_policy DLX \
  "^cypher\\..*" \
  '{"dead-letter-exchange":"cypher.dlq","dead-letter-routing-key":"#"}' \
  --apply-to queues

# Set TTL policy
rabbitmqctl set_policy TTL \
  "^cypher\\.dlq\\..*" \
  '{"message-ttl":2592000000}' \
  --apply-to queues

# Clear a policy
rabbitmqctl clear_policy DLX

# ============================================
# User and Permission Management
# ============================================

# List users
rabbitmqctl list_users

# Add a user
rabbitmqctl add_user <username> <password>

# Set permissions
rabbitmqctl set_permissions -p / <username> ".*" ".*" ".*"

# ============================================
# Monitoring and Metrics
# ============================================

# Get queue statistics
rabbitmqctl list_queues name messages messages_ready \
  messages_unacknowledged consumers

# Get exchange statistics
rabbitmqctl list_exchanges name type messages_in messages_out

# Get node statistics
rabbitmqctl status

# ============================================
# Log Management
# ============================================

# View RabbitMQ logs
docker logs rabbitmq --tail 100

# View consumer logs
docker logs consumer-service --tail 100 | grep ERROR

# Follow logs in real-time
docker logs -f consumer-service

# ============================================
# Health Checks
# ============================================

# Check RabbitMQ health
curl -u admin:admin http://localhost:15672/api/healthchecks/node

# Check queue health
curl -u admin:admin http://localhost:15672/api/queues/%2F/cypher.events.order.created

# Check vhost health
curl -u admin:admin http://localhost:15672/api/vhosts/%2F
```

### 9.3 Troubleshooting Checklist

When investigating event processing issues, use this checklist:

- [ ] Check RabbitMQ status
  - [ ] Node is running
  - [ ] All queues exist
  - [ ] Exchanges are configured
  - [ ] Bindings are correct

- [ ] Check consumer status
  - [ ] Consumer process is running
  - [ ] Consumer is connected to RabbitMQ
  - [ ] Consumer is consuming from correct queue
  - [ ] Consumer health endpoint is responding

- [ ] Check message flow
  - [ ] Messages are being published
  - [ ] Messages are reaching the queue
  - [ ] Consumer is receiving messages
  - [ ] Messages are being acknowledged

- [ ] Check for errors
  - [ ] Review consumer logs
  - [ ] Check DLQ for failed messages
  - [ ] Review error codes and categories
  - [ ] Identify patterns in failures

- [ ] Check system health
  - [ ] CPU usage is normal
  - [ ] Memory usage is normal
  - [ ] Disk space is sufficient
  - [ ] Network connectivity is stable

- [ ] Check external dependencies
  - [ ] Database is accessible
  - [ ] External services are responding
  - [ ] API endpoints are working
  - [ ] Third-party integrations are functional

---

## 10. Configuration Examples

### 10.1 Consumer Configuration

```typescript
/**
 * Consumer configuration with error handling
 */
export interface ConsumerConfig {
  // RabbitMQ connection settings
  rabbitmq: {
    url: string;
    hostname?: string;
    port?: number;
    username?: string;
    password?: string;
    vhost?: string;
    ssl?: {
      enabled: boolean;
      cert?: string;
      key?: string;
      ca?: string;
    };
  };

  // Queue settings
  queue: {
    name: string;
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
    arguments?: Record<string, any>;
  };

  // Consumer settings
  consumer: {
    prefetchCount?: number;
    timeout?: number;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  };

  // Error handling settings
  errorHandling: {
    maxRetries?: number;
    retryStrategy?: 'exponential' | 'linear' | 'custom';
    baseDelay?: number;
    maxDelay?: number;
    jitter?: number;
    dlqEnabled?: boolean;
    dlqName?: string;
    poisonDetection?: {
      enabled: boolean;
      maxConsecutiveFailures: number;
      maxTotalFailures: number;
      maxUniqueErrors: number;
    };
  };

  // Monitoring settings
  monitoring: {
    metricsEnabled?: boolean;
    loggingEnabled?: boolean;
    tracingEnabled?: boolean;
  };

  // Processing settings
  processing: {
    timeout?: number;
    batchSize?: number;
    parallelProcessing?: boolean;
    maxConcurrency?: number;
  };
}

/**
 * Default configuration
 */
export const defaultConsumerConfig: ConsumerConfig = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    vhost: process.env.RABBITMQ_VHOST || '/',
  },

  queue: {
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'cypher.dlq',
      'x-dead-letter-routing-key': '#',
      'x-message-ttl': 86400000, // 24 hours
    },
  },

  consumer: {
    prefetchCount: 10,
    timeout: 300000, // 5 minutes
    reconnectInterval: 5000, // 5 seconds
    maxReconnectAttempts: 10,
  },

  errorHandling: {
    maxRetries: 3,
    retryStrategy: 'exponential',
    baseDelay: 10000, // 10 seconds
    maxDelay: 300000, // 5 minutes
    jitter: 0.5, // 50% jitter
    dlqEnabled: true,
    dlqName: 'cypher.dlq',
    poisonDetection: {
      enabled: true,
      maxConsecutiveFailures: 3,
      maxTotalFailures: 5,
      maxUniqueErrors: 3,
    },
  },

  monitoring: {
    metricsEnabled: true,
    loggingEnabled: true,
    tracingEnabled: true,
  },

  processing: {
    timeout: 300000, // 5 minutes
    batchSize: 100,
    parallelProcessing: false,
    maxConcurrency: 1,
  },
};
```

### 10.2 Producer Configuration

```typescript
/**
 * Producer configuration
 */
export interface ProducerConfig {
  // RabbitMQ connection settings
  rabbitmq: {
    url: string;
    hostname?: string;
    port?: number;
    username?: string;
    password?: string;
    vhost?: string;
  };

  // Exchange settings
  exchange: {
    name: string;
    type: 'direct' | 'topic' | 'fanout' | 'headers';
    durable?: boolean;
    autoDelete?: boolean;
  };

  // Publishing settings
  publishing: {
    confirm?: boolean;
    mandatory?: boolean;
    immediate?: boolean;
    timeout?: number;
  };

  // Error handling
  errorHandling: {
    retryOnConnectionError?: boolean;
    maxRetries?: number;
    backoff?: number;
  };

  // Monitoring
  monitoring: {
    metricsEnabled?: boolean;
    tracingEnabled?: boolean;
  };
}

export const defaultProducerConfig: ProducerConfig = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    vhost: '/',
  },

  exchange: {
    name: 'cypher.events',
    type: 'topic',
    durable: true,
    autoDelete: false,
  },

  publishing: {
    confirm: true,
    mandatory: true,
    immediate: false,
    timeout: 5000, // 5 seconds
  },

  errorHandling: {
    retryOnConnectionError: true,
    maxRetries: 3,
    backoff: 1000, // 1 second
  },

  monitoring: {
    metricsEnabled: true,
    tracingEnabled: true,
  },
};
```

### 10.3 Retry Configuration by Event Type

```typescript
/**
 * Event-specific retry configurations
 */
export const eventRetryConfigs: Record<string, RetryConfig> = {
  // Critical events - aggressive retry
  'order.created': {
    maxRetries: 5,
    strategy: 'exponential',
    delays: [10000, 30000, 120000, 600000, 1800000], // 10s, 30s, 2m, 10m, 30m
    dlqRetention: 2592000000, // 30 days
  },

  'order.cancelled': {
    maxRetries: 5,
    strategy: 'exponential',
    delays: [10000, 30000, 120000, 600000, 1800000],
    dlqRetention: 2592000000,
  },

  'credit.changed': {
    maxRetries: 5,
    strategy: 'exponential',
    delays: [10000, 30000, 120000, 600000, 1800000],
    dlqRetention: 2592000000,
  },

  'stock.changed': {
    maxRetries: 5,
    strategy: 'exponential',
    delays: [10000, 30000, 120000, 600000, 1800000],
    dlqRetention: 2592000000,
  },

  // High priority events - standard retry
  'price.changed': {
    maxRetries: 3,
    strategy: 'exponential',
    delays: [10000, 60000, 300000], // 10s, 1m, 5m
    dlqRetention: 604800000, // 7 days
  },

  'product.updated': {
    maxRetries: 3,
    strategy: 'exponential',
    delays: [10000, 60000, 300000],
    dlqRetention: 604800000,
  },

  // Normal priority events - reduced retry
  'cart.updated': {
    maxRetries: 2,
    strategy: 'exponential',
    delays: [30000, 300000], // 30s, 5m
    dlqRetention: 86400000, // 1 day
  },

  'notification.sent': {
    maxRetries: 3,
    strategy: 'exponential',
    delays: [10000, 60000, 300000],
    dlqRetention: 86400000,
  },
};
```

### 10.4 Terraform Configuration Example

```hcl
# ==============================================================================
# RabbitMQ Error Policy Configuration
# ==============================================================================

variable "error_policy_config" {
  description = "Error policy configuration for all queues"
  type = map(object({
    enabled              = bool
    max_retries          = number
    retry_delays         = list(number)
    dlq_enabled          = bool
    dlq_retention_ms     = number
    poison_detection     = map(string)
  }))
  default = {
    default = {
      enabled          = true
      max_retries      = 3
      retry_delays     = [10000, 60000, 300000]
      dlq_enabled      = true
      dlq_retention_ms = 604800000
      poison_detection = {
        enabled                    = "true"
        max_consecutive_failures   = "3"
        max_total_failures        = "5"
        max_unique_errors         = "3"
      }
    },
    critical = {
      enabled          = true
      max_retries      = 5
      retry_delays     = [10000, 30000, 120000, 600000, 1800000]
      dlq_enabled      = true
      dlq_retention_ms = 2592000000
      poison_detection = {
        enabled                    = "true"
        max_consecutive_failures   = "3"
        max_total_failures        = "5"
        max_unique_errors         = "3"
      }
    }
  }
}

# Apply error policy to order queues
resource "rabbitmq_queue" "order_events_queue" {
  name  = "${var.prefix}.worker.order-events"
  durable = true

  # Dead letter configuration
  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.dlq
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.*"
  }

  # Message TTL
  arguments {
    key   = "x-message-ttl"
    value = var.error_policy_config.critical.dlq_retention_ms
  }

  # Poison detection metadata
  tags {
    name  = "error-policy"
    value = "critical"
  }

  tags {
    name  = "max-retries"
    value = tostring(var.error_policy_config.critical.max_retries)
  }
}

# DLQ for order events
resource "rabbitmq_queue" "order_events_dlq" {
  name  = "${local.prefix}.dlq.order-events"
  durable = true

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "purpose"
    value = "dead-letter-queue"
  }
}
```

### 10.5 Prometheus Alert Configuration

```yaml
# ==============================================================================
# RabbitMQ Error Policy Alerts
# ==============================================================================

groups:
  - name: rabbitmq_error_policy
    interval: 30s
    rules:
      # DLQ messages alert
      - alert: RabbitMQDLQMessages
        expr: rabbitmq_queue_messages{queue=~".*\\.dlq\\..*"} > 0
        for: 1m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "DLQ has messages: {{ $labels.queue }}"
          description: "Queue {{ $labels.queue }} has {{ $value }} messages"
          runbook: "https://docs.cypher.ro/error-policy#dlq-handling"

      # High DLQ count alert
      - alert: RabbitMQDLQHighCount
        expr: rabbitmq_queue_messages{queue=~".*\\.dlq\\..*"} > 100
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Critical DLQ count: {{ $labels.queue }}"
          description: "DLQ {{ $labels.queue }} has {{ $value }} messages"
          runbook: "https://docs.cypher.ro/error-policy#dlq-handling"

      # Stale messages in DLQ
      - alert: RabbitMQDLQStaleMessages
        expr: rabbitmq_queue_messages_ready{queue=~".*\\.dlq\\..*"} > 10
        for: 1h
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Stale messages in DLQ: {{ $labels.queue }}"
          description: "Messages older than 1 hour in {{ $labels.queue }}"

      # High retry rate
      - alert: RabbitMQHighRetryRate
        expr: rate(rabbitmq_queue_messages_published_total{queue=~".*\\.retry\\..*"}[5m]) > 10
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "High retry rate for {{ $labels.queue }}"
          description: "{{ $value }} retries per second detected"

      # Poison message alert
      - alert: RabbitMQPoisonMessageDetected
        expr: increase(poison_messages_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Poison message detected"
          description: "A poison message was detected and quarantined"

      # Consumer error rate
      - alert: RabbitMQConsumerHighErrorRate
        expr: rate(consumer_errors_total[5m]) / rate(consumer_messages_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "High consumer error rate: {{ $labels.consumer }}"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Connection errors
      - alert: RabbitMQConnectionErrors
        expr: increase(rabbitmq_connection_errors_total[5m]) > 5
        for: 2m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "RabbitMQ connection errors detected"
          description: "{{ $value }} connection errors in last 5 minutes"

      # Unacked messages
      - alert: RabbitMQHighUnackedMessages
        expr: rabbitmq_queue_messages_unacknowledged / rabbitmq_queue_messages > 0.5
        for: 10m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "High unacked messages: {{ $labels.queue }}"
          description: "{{ $value | humanizePercentage }} of messages are unacked"
```

### 10.6 Docker Compose Configuration

```yaml
# ==============================================================================
# RabbitMQ with Error Policy Configuration
# ==============================================================================

version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3.12-management
    hostname: rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-admin}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-admin}
      RABBITMQ_DEFAULT_VHOST: /
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - ./rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./rabbitmq/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  event-consumer:
    image: cypher/event-consumer:latest
    depends_on:
      rabbitmq:
        condition: service_healthy
    environment:
      RABBITMQ_URL: amqp://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD:-admin}@rabbitmq:5672
      ERROR_HANDLING_MAX_RETRIES: ${MAX_RETRIES:-3}
      ERROR_HANDLING_BASE_DELAY: ${BASE_DELAY:-10000}
      ERROR_HANDLING_MAX_DELAY: ${MAX_DELAY:-300000}
      POISON_DETECTION_ENABLED: "true"
      POISON_DETECTION_MAX_CONSECUTIVE: ${POISON_MAX_CONSECUTIVE:-3}
      POISON_DETECTION_MAX_TOTAL: ${POISON_MAX_TOTAL:-5}
    volumes:
      - ./config:/app/config:ro
    restart: unless-stopped

  dlq-monitor:
    image: cypher/dlq-monitor:latest
    depends_on:
      rabbitmq:
        condition: service_healthy
    environment:
      RABBITMQ_URL: http://${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD:-admin}@rabbitmq:15672
      ALERT_WEBHOOK: ${ALERT_WEBHOOK}
      ALERT_ENABLED: "true"
      CHECK_INTERVAL: 30
    restart: unless-stopped

volumes:
  rabbitmq_data:
```

---

## Appendix A: Quick Reference

### Error Codes Summary

| Category | Prefix | Retry | DLQ | Alert |
|----------|--------|-------|-----|-------|
| Network | `NET_` | Yes | After max | Warning |
| Database | `DB_` | Depends | Depends | Warning |
| External | `EXT_` | Depends | Depends | Warning |
| Validation | `VAL_` | No | Immediate | Info |
| Business | `BIZ_` | No | Immediate | Info |
| Poison | `POISON_` | No | Immediate | Critical |

### Retry Delays Summary

| Level | Delay | Max Total |
|-------|-------|-----------|
| Level 1 | 10 seconds | 10s |
| Level 2 | 1 minute | 1m 10s |
| Level 3 | 5 minutes | 6m 10s |
| Level 4 | 10 minutes | 16m 10s |
| Level 5 | 30 minutes | 46m 10s |

### Contact Information

| Role | Email | On-Call |
|------|-------|---------|
| Platform Lead | platform@cypher.ro | +40 7XX XXX XXX |
| Events Architect | events@cypher.ro | +40 7XX XXX XXX |
| DBA Team | dba@cypher.ro | +40 7XX XXX XXX |

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Owner:** AI 3 (Event Bus Engineer)
**Next Review:** 2026-05-13
**Change Log:**
- v1.0 (2026-02-13): Initial version - Complete error policy definition
