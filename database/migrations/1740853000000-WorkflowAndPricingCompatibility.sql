BEGIN;

-- Pricing compatibility: provide expected table used by pricing-engine module
CREATE TABLE IF NOT EXISTS volume_discount_rules (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  min_quantity INTEGER NULL,
  max_quantity INTEGER NULL,
  min_total_value NUMERIC(12,2) NULL,
  discount_percentage NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volume_discount_rules_product_active_qty
  ON volume_discount_rules (product_id, is_active, min_quantity, max_quantity);

INSERT INTO volume_discount_rules (
  product_id,
  min_quantity,
  max_quantity,
  min_total_value,
  discount_percentage,
  is_active,
  created_at,
  updated_at
)
SELECT
  vd.product_id,
  vd.min_quantity,
  vd.max_quantity,
  vd.discount_amount,
  vd.discount_percentage,
  vd.is_active,
  COALESCE(vd.created_at::timestamp, NOW()),
  COALESCE(vd.updated_at::timestamp, NOW())
FROM volume_discounts vd
LEFT JOIN volume_discount_rules vdr
  ON vdr.product_id = vd.product_id
 AND COALESCE(vdr.min_quantity, -1) = COALESCE(vd.min_quantity, -1)
 AND COALESCE(vdr.max_quantity, -1) = COALESCE(vd.max_quantity, -1)
 AND COALESCE(vdr.discount_percentage, -1) = COALESCE(vd.discount_percentage, -1)
WHERE vdr.id IS NULL;

-- Workflow engine base tables
CREATE TABLE IF NOT EXISTS workflow_templates (
  id VARCHAR PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  "entityType" VARCHAR(100) NOT NULL,
  version INT NOT NULL,
  steps JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_entity_type_version
  ON workflow_templates ("entityType", version);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_entity_type_active
  ON workflow_templates ("entityType", "isActive");
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active
  ON workflow_templates ("isActive");

CREATE TABLE IF NOT EXISTS workflow_instances (
  id VARCHAR PRIMARY KEY,
  "templateId" VARCHAR NOT NULL,
  "entityType" VARCHAR(100) NOT NULL,
  "entityId" VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  "currentStepId" VARCHAR NOT NULL,
  steps JSONB NOT NULL,
  metadata JSONB NULL,
  "createdBy" VARCHAR NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity
  ON workflow_instances ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_workflow_instances_template
  ON workflow_instances ("templateId");
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status
  ON workflow_instances (status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_current_step
  ON workflow_instances ("currentStepId");
CREATE INDEX IF NOT EXISTS idx_workflow_instances_created_at
  ON workflow_instances ("createdAt");

CREATE TABLE IF NOT EXISTS workflow_delegations (
  id VARCHAR PRIMARY KEY,
  "fromUserId" VARCHAR NOT NULL,
  "toUserId" VARCHAR NOT NULL,
  "workflowStepId" VARCHAR NOT NULL,
  reason TEXT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMP NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_workflow_delegations_users
  ON workflow_delegations ("fromUserId", "toUserId");
CREATE INDEX IF NOT EXISTS idx_workflow_delegations_step
  ON workflow_delegations ("workflowStepId");
CREATE INDEX IF NOT EXISTS idx_workflow_delegations_expires
  ON workflow_delegations ("expiresAt");

CREATE TABLE IF NOT EXISTS workflow_analytics (
  id VARCHAR PRIMARY KEY,
  "templateId" VARCHAR NOT NULL,
  "entityType" VARCHAR(100) NOT NULL,
  "instanceId" VARCHAR NOT NULL,
  "stepId" VARCHAR NOT NULL,
  "totalApprovals" INT NOT NULL,
  "totalRejections" INT NOT NULL,
  "escalationCount" INT NOT NULL,
  "durationMs" BIGINT NOT NULL,
  "completedAt" TIMESTAMP NOT NULL,
  outcome VARCHAR(50) NOT NULL,
  "recordedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_analytics_template_entity
  ON workflow_analytics ("templateId", "entityType");
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_recorded
  ON workflow_analytics ("recordedAt");

-- Default active template for pricing approval workflow fallback
INSERT INTO workflow_templates (
  id,
  name,
  description,
  "entityType",
  version,
  steps,
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'pricing-exception-default-v1',
  'Pricing Exception Approval',
  'Default approval flow for pricing guardrail violations',
  'pricing_calculation',
  1,
  '[{"id":"step_manager_approval","name":"Manager Approval","order":1,"type":"sequential","approvers":[{"id":"role_manager","type":"role","value":"manager"}],"requireAll":false,"timeout":1440}]'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_templates WHERE "entityType" = 'pricing_calculation' AND "isActive" = true
);

COMMIT;
