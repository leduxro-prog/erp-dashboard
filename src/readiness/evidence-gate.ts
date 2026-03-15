export interface EvidenceMetrics {
  productCount?: number;
  imageCompletenessPct?: number;
  documentCompletenessPct?: number;
  facetCoveragePct?: number;
  browseP95Ms?: number;
  searchP95Ms?: number;
  pdpP95Ms?: number;
  replayValidationPassed?: boolean;
  reindexValidationPassed?: boolean;
  erpDatasetParityPassed?: boolean;
}

export type GateStatus = 'pass' | 'blocked';

export interface EvidenceCheck {
  key: string;
  passed: boolean;
  expected: string;
  actual: number | boolean;
}

export interface EvidenceGateResult {
  status: GateStatus;
  checks: EvidenceCheck[];
  failed: EvidenceCheck[];
}

function asNumber(value: number | undefined, fallback: number = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(value: boolean | undefined): boolean {
  return value === true;
}

export function evaluate100kEvidenceGate(metrics?: EvidenceMetrics): EvidenceGateResult {
  const input = metrics || {};
  const checks: EvidenceCheck[] = [
    {
      key: 'productCount',
      passed: asNumber(input.productCount) >= 100000,
      expected: '>= 100000',
      actual: asNumber(input.productCount),
    },
    {
      key: 'imageCompletenessPct',
      passed: asNumber(input.imageCompletenessPct) >= 98,
      expected: '>= 98',
      actual: asNumber(input.imageCompletenessPct),
    },
    {
      key: 'documentCompletenessPct',
      passed: asNumber(input.documentCompletenessPct) >= 95,
      expected: '>= 95',
      actual: asNumber(input.documentCompletenessPct),
    },
    {
      key: 'facetCoveragePct',
      passed: asNumber(input.facetCoveragePct) >= 97,
      expected: '>= 97',
      actual: asNumber(input.facetCoveragePct),
    },
    {
      key: 'browseP95Ms',
      passed: asNumber(input.browseP95Ms, Infinity) <= 350,
      expected: '<= 350',
      actual: asNumber(input.browseP95Ms, Infinity),
    },
    {
      key: 'searchP95Ms',
      passed: asNumber(input.searchP95Ms, Infinity) <= 250,
      expected: '<= 250',
      actual: asNumber(input.searchP95Ms, Infinity),
    },
    {
      key: 'pdpP95Ms',
      passed: asNumber(input.pdpP95Ms, Infinity) <= 200,
      expected: '<= 200',
      actual: asNumber(input.pdpP95Ms, Infinity),
    },
    {
      key: 'replayValidationPassed',
      passed: asBoolean(input.replayValidationPassed),
      expected: 'true',
      actual: Boolean(input.replayValidationPassed),
    },
    {
      key: 'reindexValidationPassed',
      passed: asBoolean(input.reindexValidationPassed),
      expected: 'true',
      actual: Boolean(input.reindexValidationPassed),
    },
    {
      key: 'erpDatasetParityPassed',
      passed: asBoolean(input.erpDatasetParityPassed),
      expected: 'true',
      actual: Boolean(input.erpDatasetParityPassed),
    },
  ];

  const failed = checks.filter((item) => !item.passed);
  return {
    status: failed.length === 0 ? 'pass' : 'blocked',
    checks,
    failed,
  };
}
