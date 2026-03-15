import { describe, expect, it } from '@jest/globals';

import { evaluateErpSyncReleaseGate } from '../../src/config/erp-sync-release-gate';

describe('ErpSyncReleaseGate', () => {
  it('production gate blocks when mandatory hardening controls are missing', () => {
    const result = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: '',
        ERP_SYNC_HMAC_SECRET: '',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'false',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'false',
      },
      'production',
    );

    expect(result.status).toBe('blocked');
    expect(result.violations.length).toBeGreaterThanOrEqual(4);
  });

  it('production gate passes when all mandatory controls are enabled', () => {
    const result = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: 'token-123',
        ERP_SYNC_HMAC_SECRET: 'hmac-123',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'true',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'true',
      },
      'production',
    );

    expect(result.status).toBe('pass');
    expect(result.violations.length).toBe(0);
  });

  it('rehearsal uses same strict requirements as production', () => {
    const blocked = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: 'token-123',
        ERP_SYNC_HMAC_SECRET: 'hmac-123',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'true',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'false',
      },
      'rehearsal',
    );

    expect(blocked.status).toBe('blocked');
  });

  it('staging allows weaker hardening but still requires ingest token baseline', () => {
    const ok = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: 'token-123',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'false',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'false',
      },
      'staging',
    );

    expect(ok.status).toBe('pass');

    const blocked = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: '',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'false',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'false',
      },
      'staging',
    );

    expect(blocked.status).toBe('blocked');
  });

  it('result includes environmentIntent in output', () => {
    const result = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: 'token-123',
        ERP_SYNC_HMAC_SECRET: 'hmac-123',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'true',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'true',
      },
      'production',
    );

    expect(result.environmentIntent).toBe('production');
  });

  it('result includes per-check breakdown in checks array', () => {
    const result = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: 'token-123',
        ERP_SYNC_HMAC_SECRET: 'hmac-123',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'true',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'true',
      },
      'production',
    );

    expect(Array.isArray(result.checks)).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.checks[0]).toHaveProperty('key');
    expect(result.checks[0]).toHaveProperty('passed');
    expect(result.checks[0]).toHaveProperty('required');
  });

  it('local intent is treated like staging (weaker controls allowed with token)', () => {
    const ok = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: 'token-local',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'false',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'false',
      },
      'local',
    );

    expect(ok.status).toBe('pass');

    const blocked = evaluateErpSyncReleaseGate(
      {
        ERP_SYNC_INGEST_TOKEN: '',
        ERP_SYNC_REQUIRE_SOURCE_ALLOWLIST: 'false',
        ERP_SYNC_REQUIRE_HMAC_SIGNATURE: 'false',
      },
      'local',
    );

    expect(blocked.status).toBe('blocked');
  });
});
