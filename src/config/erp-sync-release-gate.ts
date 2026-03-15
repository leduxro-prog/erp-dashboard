export type GateStatus = 'pass' | 'blocked';
export type EnvironmentIntent = 'local' | 'staging' | 'rehearsal' | 'production';

export interface GateCheck {
  key: string;
  passed: boolean;
  required: boolean;
}

export interface GateResult {
  environmentIntent: string;
  status: GateStatus;
  checks: GateCheck[];
  violations: string[];
}

export interface ErpSyncEnv {
  ERP_SYNC_INGEST_TOKEN?: string;
  ERP_SYNC_HMAC_SECRET?: string;
  ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST?: string;
  ERP_SYNC_REQUIRE_HMAC_SIGNATURE?: string;
}

function normalize(value: string | undefined): string {
  return String(value ?? '').trim();
}

function toBoolean(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function evaluateErpSyncReleaseGate(
  env: ErpSyncEnv = {},
  environmentIntent: string = 'staging',
): GateResult {
  const intent = String(environmentIntent ?? 'staging')
    .trim()
    .toLowerCase();
  const isStrict = intent !== 'staging' && intent !== 'local';
  const checks: GateCheck[] = [];

  const hasToken = normalize(env.ERP_SYNC_INGEST_TOKEN).length > 0;
  checks.push({ key: 'ERP_SYNC_INGEST_TOKEN', passed: hasToken, required: true });

  const hasHmac = normalize(env.ERP_SYNC_HMAC_SECRET).length > 0;
  checks.push({ key: 'ERP_SYNC_HMAC_SECRET', passed: hasHmac, required: isStrict });

  const requireAllowlist = toBoolean(env.ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST);
  checks.push({
    key: 'ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST',
    passed: isStrict ? requireAllowlist === true : true,
    required: isStrict,
  });

  const requireSignature = toBoolean(env.ERP_SYNC_REQUIRE_HMAC_SIGNATURE);
  checks.push({
    key: 'ERP_SYNC_REQUIRE_HMAC_SIGNATURE',
    passed: isStrict ? requireSignature === true : true,
    required: isStrict,
  });

  const violations = checks
    .filter((item) => item.required && !item.passed)
    .map((item) => `${item.key} missing or invalid`);

  return {
    environmentIntent: intent,
    status: violations.length === 0 ? 'pass' : 'blocked',
    checks,
    violations,
  };
}
