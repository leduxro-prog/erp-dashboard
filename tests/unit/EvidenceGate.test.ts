import { describe, expect, it } from '@jest/globals';

import { evaluate100kEvidenceGate } from '../../src/readiness/evidence-gate';

describe('EvidenceGate', () => {
  it('evidence gate passes when all 100k thresholds are met', () => {
    const result = evaluate100kEvidenceGate({
      productCount: 100000,
      imageCompletenessPct: 98.5,
      documentCompletenessPct: 95.2,
      facetCoveragePct: 97.1,
      browseP95Ms: 340,
      searchP95Ms: 240,
      pdpP95Ms: 180,
      replayValidationPassed: true,
      reindexValidationPassed: true,
      erpDatasetParityPassed: true,
    });

    expect(result.status).toBe('pass');
    expect(result.failed.length).toBe(0);
  });

  it('evidence gate blocks when any threshold fails', () => {
    const result = evaluate100kEvidenceGate({
      productCount: 99000,
      imageCompletenessPct: 97,
      documentCompletenessPct: 96,
      facetCoveragePct: 97,
      browseP95Ms: 360,
      searchP95Ms: 220,
      pdpP95Ms: 210,
      replayValidationPassed: true,
      reindexValidationPassed: false,
      erpDatasetParityPassed: true,
    });

    expect(result.status).toBe('blocked');
    expect(result.failed.length).toBeGreaterThanOrEqual(1);

    const failedKeys = result.failed.map((item) => item.key);
    expect(failedKeys).toContain('productCount');
    expect(failedKeys).toContain('imageCompletenessPct');
    expect(failedKeys).toContain('browseP95Ms');
    expect(failedKeys).toContain('pdpP95Ms');
    expect(failedKeys).toContain('reindexValidationPassed');
  });

  it('blocks and safely handles empty input', () => {
    const result = evaluate100kEvidenceGate();

    expect(result.status).toBe('blocked');
    expect(result.checks.length).toBe(10);
    expect(result.failed.length).toBe(10); // All 10 checks fail on empty input
  });

  it('returns correct expected threshold strings in check results', () => {
    const result = evaluate100kEvidenceGate();

    const expectedMap = new Map(result.checks.map((item) => [item.key, item.expected]));

    expect(expectedMap.get('productCount')).toBe('>= 100000');
    expect(expectedMap.get('imageCompletenessPct')).toBe('>= 98');
    expect(expectedMap.get('documentCompletenessPct')).toBe('>= 95');
    expect(expectedMap.get('facetCoveragePct')).toBe('>= 97');
    expect(expectedMap.get('browseP95Ms')).toBe('<= 350');
    expect(expectedMap.get('searchP95Ms')).toBe('<= 250');
    expect(expectedMap.get('pdpP95Ms')).toBe('<= 200');
    expect(expectedMap.get('replayValidationPassed')).toBe('true');
    expect(expectedMap.get('reindexValidationPassed')).toBe('true');
    expect(expectedMap.get('erpDatasetParityPassed')).toBe('true');
  });
});
