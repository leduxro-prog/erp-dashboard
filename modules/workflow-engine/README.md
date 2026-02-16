# Workflow Engine Module

A comprehensive, production-ready Workflow/Approval Engine for Cypher ERP that supports complex, configurable approval workflows for any entity type.

## Quick Start

### Installation

```bash
# Already integrated in Cypher module system
# No additional installation needed
```

### Basic Usage

#### 1. Create a Workflow Template

```bash
POST /api/v1/workflow-engine/templates
Content-Type: application/json

{
  "name": "Purchase Order Approval",
  "description": "Standard approval process for purchase orders",
  "entityType": "purchase_order",
  "steps": [
    {
      "id": "step_manager",
      "name": "Manager Approval",
      "order": 1,
      "type": "sequential",
      "requireAll": false,
      "approvers": [
        {
          "id": "approver_1",
          "type": "role",
          "value": "department_manager"
        }
      ],
      "timeout": 24
    },
    {
      "id": "step_cfo",
      "name": "CFO Approval",
      "order": 2,
      "type": "sequential",
      "requireAll": true,
      "approvers": [
        {
          "id": "approver_2",
          "type": "role",
          "value": "cfo"
        }
      ],
      "timeout": 48,
      "conditions": [
        {
          "field": "amount",
          "operator": "gte",
          "value": 10000
        }
      ]
    }
  ]
}
```

#### 2. Start a Workflow Instance

```bash
POST /api/v1/workflow-engine/instances
Content-Type: application/json

{
  "templateId": "template_xyz",
  "entityType": "purchase_order",
  "entityId": "PO-2024-001",
  "metadata": {
    "amount": 50000,
    "department": "Engineering",
    "vendor": "Acme Corp"
  }
}
```

#### 3. Submit Approval

```bash
POST /api/v1/workflow-engine/instances/wf_123_abc/approve
Content-Type: application/json

{
  "decision": "approved",
  "comment": "Approved after review"
}
```

#### 4. Check Pending Approvals

```bash
GET /api/v1/workflow-engine/pending-approvals

# Returns all workflows waiting for user's approval
```

## Features

### Core Capabilities

- **Multi-Step Workflows**: Sequential and parallel approval paths
- **Flexible Approvers**: Role-based, user-based, or mixed approval requirements
- **Conditional Routing**: Route to different steps based on entity properties
- **Timeout & Escalation**: Auto-escalate overdue approvals
- **Audit Trail**: Complete history of all approvals and changes
- **Event-Driven**: Integrates with other modules via event bus
- **Caching**: Multi-tier caching for performance
- **Analytics**: Track approval metrics and identify bottlenecks

### Entity Types Supported

- Purchase Orders
- Leave Requests
- Journal Entries
- Requisitions
- Any custom entity type

### Approval Logic

**Sequential Steps**: Each step must complete before moving to next
```
Step 1 → Step 2 → Step 3 → Approved
```

**Parallel Steps**: Multiple steps can execute simultaneously (not yet implemented)

**ANY Approver**: Step completes when any approver approves
```
Manager OR Department Head → Approved
```

**ALL Approvers**: Step completes only when all approvers approve
```
Manager AND Department Head → Approved
```

## API Reference

### Templates

```
POST   /api/v1/workflow-engine/templates              # Create template
GET    /api/v1/workflow-engine/templates              # List templates
GET    /api/v1/workflow-engine/templates/:id          # Get template
PUT    /api/v1/workflow-engine/templates/:id          # Update template
DELETE /api/v1/workflow-engine/templates/:id          # Delete template
```

### Instances

```
POST   /api/v1/workflow-engine/instances              # Create instance
GET    /api/v1/workflow-engine/instances              # List instances
GET    /api/v1/workflow-engine/instances/:id          # Get instance
GET    /api/v1/workflow-engine/instances/entity/:type/:id  # Get by entity
```

### Approvals

```
POST   /api/v1/workflow-engine/instances/:id/approve  # Submit approval
GET    /api/v1/workflow-engine/pending-approvals      # Get pending items
```

### Escalation

```
POST   /api/v1/workflow-engine/instances/:id/escalate # Escalate workflow
```

### Analytics

```
GET    /api/v1/workflow-engine/analytics/templates/:id # Get analytics
```

## Workflow Statuses

| Status | Description |
|--------|-------------|
| `pending` | Workflow created, not yet started |
| `in_progress` | Workflow actively being processed |
| `approved` | Workflow completed with approval |
| `rejected` | Workflow rejected by an approver |
| `cancelled` | Workflow manually cancelled |
| `escalated` | Workflow escalated due to timeout |

## Configuration

### Feature Flag

Enable/disable the module:
```
WORKFLOW_ENGINE=true
```

### Cache Configuration

The module uses the shared cache manager with these TTLs:
- Templates: 1 hour
- Instances: 5 minutes
- Pending Approvals: 1 minute
- Analytics: 30 minutes

## Events

### Published Events

The module publishes these events for other modules to react:

```typescript
'workflow.started'        // Workflow instance created
'workflow.step_completed' // Step approved, moving to next step
'workflow.approved'       // Entire workflow approved
'workflow.rejected'       // Workflow rejected
'workflow.escalated'      // Workflow escalated due to timeout
```

### Subscribed Events

The module listens for these events to start workflows:

```typescript
'po.created'              // Create PO approval workflow
'leave.requested'         // Create leave approval workflow
'journal.created'         // Create journal entry approval workflow
'requisition.created'     // Create requisition approval workflow
```

## Architecture

```
API Layer (Controllers, Validators)
    ↓
Application Layer (Use Cases)
    ↓
Domain Layer (Entities, Services, Interfaces)
    ↓
Infrastructure Layer (TypeORM, Cache, Repositories)
    ↓
Database + Redis Cache
```

## Error Handling

All errors follow a standard format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "statusCode": 400
  }
}
```

Common errors:
- `TEMPLATE_NOT_FOUND` (404)
- `INSTANCE_NOT_FOUND` (404)
- `INVALID_TEMPLATE` (400)
- `UNAUTHORIZED_APPROVAL` (403)
- `WORKFLOW_COMPLETED` (400)

## Performance

### Caching

- Templates cached for 1 hour (rarely change)
- Instances cached for 5 minutes (frequently updated)
- Pending approvals cached for 1 minute (must be fresh)

### Database

- Proper indexes on frequently queried columns
- Pagination support for large result sets
- Efficient queries using TypeORM QueryBuilder

### Background Jobs

- Escalation checker runs every 5 minutes
- Checks for overdue in-progress workflows
- Publishes escalation events

## Examples

### Example 1: Simple Single-Step Approval

```typescript
const template = await createTemplateUseCase.execute({
  name: 'Simple Review',
  description: 'Single reviewer approval',
  entityType: 'article',
  steps: [
    {
      id: 'step_review',
      name: 'Review',
      order: 1,
      type: 'sequential',
      requireAll: false,
      approvers: [
        { id: 'reviewer_1', type: 'user', value: 'john.doe' }
      ]
    }
  ]
});
```

### Example 2: Amount-Based Approval

```typescript
const template = {
  name: 'Variable Approval',
  description: 'Different approvers based on amount',
  entityType: 'purchase_order',
  steps: [
    {
      id: 'step_manager',
      name: 'Manager Approval',
      order: 1,
      type: 'sequential',
      requireAll: false,
      approvers: [{ type: 'role', value: 'manager' }],
      conditions: [{ field: 'amount', operator: 'lt', value: 10000 }]
    },
    {
      id: 'step_director',
      name: 'Director Approval',
      order: 1,
      type: 'sequential',
      requireAll: false,
      approvers: [{ type: 'role', value: 'director' }],
      conditions: [{ field: 'amount', operator: 'gte', value: 10000 }]
    }
  ]
};
```

### Example 3: Multi-Level Approval

```typescript
const template = {
  name: 'Escalating Approval',
  entityType: 'leave_request',
  steps: [
    {
      id: 'step_manager',
      name: 'Manager',
      order: 1,
      type: 'sequential',
      requireAll: false,
      approvers: [{ type: 'role', value: 'manager' }],
      timeout: 24,
      escalationRule: {
        escalateAfterMinutes: 1440,
        escalateTo: 'director',
        notifyInterval: 360
      }
    },
    {
      id: 'step_director',
      name: 'Director',
      order: 2,
      type: 'sequential',
      requireAll: false,
      approvers: [{ type: 'role', value: 'director' }],
      timeout: 24
    },
    {
      id: 'step_hr',
      name: 'HR Confirmation',
      order: 3,
      type: 'sequential',
      requireAll: true,
      approvers: [
        { type: 'role', value: 'hr_officer' },
        { type: 'role', value: 'payroll_officer' }
      ]
    }
  ]
};
```

## Troubleshooting

### Workflow stuck in pending

- Check if approvers have the correct role
- Check user exists in the system
- Verify user has permission to approve

### Escalation not triggering

- Check escalation rule is configured on step
- Verify timeout value is correct (in minutes)
- Check background job is running (logs should show)

### Cache issues

- Cache is invalidated automatically on updates
- If stale data appears, manually clear cache:
  ```bash
  redis-cli DEL "wf:*"
  ```

## Development

### Adding Custom Entity Type

1. Create workflow template for your entity type
2. Subscribe to your entity creation event
3. Use engine to create instance automatically
4. Workflow engine handles rest

### Extending Approval Logic

Modify `WorkflowEngine.isStepCompleted()` to add custom logic:
```typescript
// Current: ALL vs ANY logic
// Can add: Quorum (2 of 3), Unanimous, etc.
```

## Future Roadmap

- [ ] Workflow designer UI
- [ ] Advanced analytics dashboard
- [ ] Mobile notifications
- [ ] Bulk approval operations
- [ ] Workflow simulation
- [ ] Complex conditions (AND/OR logic)
- [ ] Webhook integration
- [ ] Audit export for compliance

## Support

For issues or questions:
1. Check IMPLEMENTATION_SUMMARY.md for detailed documentation
2. Review test cases in tests/
3. Check API error messages for specific issues

## License

Proprietary - Cypher ERP
