import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { DataSource } from 'typeorm';

import {
  CustomerMatchingService,
  MatchResult,
  normalizePhone,
} from '../../src/application/services/CustomerMatchingService';

// Helper to build ERP customer rows returned by dataSource.query
function buildErpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    company_name: 'Default Company',
    tax_identification_number: null,
    email: null,
    phone_number: null,
    contact_person_name: null,
    contact_person_email: null,
    contact_person_phone: null,
    ...overrides,
  };
}

describe('CustomerMatchingService', () => {
  let service: CustomerMatchingService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDataSource: { query: jest.Mock<any> };

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn(),
    };
    service = new CustomerMatchingService(mockDataSource as unknown as DataSource);
  });

  // ----- Scoring tests -----

  it('should score CUI exact match at 50 points', async () => {
    mockDataSource.query.mockResolvedValue([
      buildErpRow({ id: 1, company_name: 'Alfa SRL', tax_identification_number: 'RO12345678' }),
    ]);

    const result = await service.findMatches({
      name: 'Something Else',
      vatCode: 'RO12345678',
      email: '',
      phone: '',
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchScore).toBe(50);
    expect(result.candidates[0].matchReasons).toContain('CUI exact match (+50)');
  });

  it('should score email exact match at 35 points', async () => {
    mockDataSource.query.mockResolvedValue([
      buildErpRow({ id: 2, company_name: 'Beta SRL', email: 'contact@beta.ro' }),
    ]);

    const result = await service.findMatches({
      name: 'Something Else',
      vatCode: '',
      email: 'contact@beta.ro',
      phone: '',
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchScore).toBe(35);
    expect(result.candidates[0].matchReasons).toContain('Email exact match (+35)');
  });

  it('should score phone match at 25 points (with normalization)', async () => {
    mockDataSource.query.mockResolvedValue([
      buildErpRow({ id: 3, company_name: 'Gamma SRL', phone_number: '+40 721 123 456' }),
    ]);

    const result = await service.findMatches({
      name: 'Something Else',
      vatCode: '',
      email: '',
      phone: '0721-123-456',
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchScore).toBe(25);
    expect(result.candidates[0].matchReasons).toContain('Phone exact match (+25)');
  });

  it('should score company name exact match at 30 points', async () => {
    mockDataSource.query.mockResolvedValue([buildErpRow({ id: 4, company_name: 'Delta SRL' })]);

    const result = await service.findMatches({
      name: 'Delta SRL',
      vatCode: '',
      email: '',
      phone: '',
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchScore).toBe(30);
    expect(result.candidates[0].matchReasons).toContain('Company name exact match (+30)');
  });

  it('should score company name fuzzy match at 20 points', async () => {
    mockDataSource.query.mockResolvedValue([buildErpRow({ id: 5, company_name: 'Epsilon SRL' })]);

    // "Epsilon SR" is contained-in / Levenshtein-close to "Epsilon SRL"
    const result = await service.findMatches({
      name: 'Epsilon SR',
      vatCode: '',
      email: '',
      phone: '',
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchScore).toBe(20);
    expect(result.candidates[0].matchReasons).toContain('Company name fuzzy match (+20)');
  });

  it('should score email domain match at 15 points', async () => {
    mockDataSource.query.mockResolvedValue([
      buildErpRow({ id: 6, company_name: 'Zeta SRL', email: 'sales@zeta.ro' }),
    ]);

    const result = await service.findMatches({
      name: 'Something Else',
      vatCode: '',
      email: 'info@zeta.ro',
      phone: '',
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchScore).toBe(15);
    expect(result.candidates[0].matchReasons).toContain('Email domain match (+15)');
  });

  // ----- Combined scoring -----

  it('should combine multiple criteria for total score', async () => {
    mockDataSource.query.mockResolvedValue([
      buildErpRow({
        id: 10,
        company_name: 'Combined SRL',
        tax_identification_number: 'RO99999999',
        email: 'office@combined.ro',
        phone_number: '0722000111',
      }),
    ]);

    const result = await service.findMatches({
      name: 'Combined SRL',
      vatCode: 'RO99999999',
      email: 'office@combined.ro',
      phone: '0722000111',
    });

    // CUI(50) + Email(35) + Phone(25) + CompanyNameExact(30) = 140 -> capped at 100
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchScore).toBe(100);
    expect(result.candidates[0].matchReasons).toEqual(
      expect.arrayContaining([
        'CUI exact match (+50)',
        'Email exact match (+35)',
        'Phone exact match (+25)',
        'Company name exact match (+30)',
      ]),
    );
  });

  // ----- Confidence classification -----

  it('should classify high confidence (score >= 80)', async () => {
    // CUI(50) + CompanyNameExact(30) = 80
    mockDataSource.query.mockResolvedValue([
      buildErpRow({
        id: 20,
        company_name: 'HighConf SRL',
        tax_identification_number: 'RO11111111',
      }),
    ]);

    const result = await service.findMatches({
      name: 'HighConf SRL',
      vatCode: 'RO11111111',
      email: '',
      phone: '',
    });

    expect(result.candidates[0].confidence).toBe('high');
    expect(result.candidates[0].matchScore).toBe(80);
  });

  it('should classify medium confidence (50-79)', async () => {
    // CUI(50) only = 50
    mockDataSource.query.mockResolvedValue([
      buildErpRow({
        id: 21,
        company_name: 'MedConf SRL',
        tax_identification_number: 'RO22222222',
      }),
    ]);

    const result = await service.findMatches({
      name: 'Completely Different',
      vatCode: 'RO22222222',
      email: '',
      phone: '',
    });

    expect(result.candidates[0].confidence).toBe('medium');
    expect(result.candidates[0].matchScore).toBe(50);
  });

  it('should classify low confidence (< 50)', async () => {
    // Email domain only = 15
    mockDataSource.query.mockResolvedValue([
      buildErpRow({ id: 22, company_name: 'LowConf SRL', email: 'anything@lowconf.ro' }),
    ]);

    const result = await service.findMatches({
      name: 'Something Else',
      vatCode: '',
      email: 'other@lowconf.ro',
      phone: '',
    });

    expect(result.candidates[0].confidence).toBe('low');
    expect(result.candidates[0].matchScore).toBeLessThan(50);
  });

  // ----- Top 5 / sorting -----

  it('should return top 5 candidates sorted by score', async () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      buildErpRow({
        id: 100 + i,
        company_name: `Company ${i}`,
        email: `info${i}@domain.ro`,
        // Give one candidate an extra phone match to differentiate scores
        ...(i === 2 ? { phone_number: '0700000002' } : {}),
      }),
    );
    mockDataSource.query.mockResolvedValue(rows);

    const result = await service.findMatches({
      name: 'Something Else',
      vatCode: '',
      email: 'test@domain.ro',
      phone: '0700000002',
    });

    expect(result.candidates.length).toBeLessThanOrEqual(5);
    // Scores are in descending order
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].matchScore).toBeGreaterThanOrEqual(
        result.candidates[i].matchScore,
      );
    }
  });

  // ----- Auto-match suggestion -----

  it('should suggest auto-match for score >= 80', async () => {
    // CUI(50) + CompanyNameExact(30) = 80 => high confidence => auto-match
    mockDataSource.query.mockResolvedValue([
      buildErpRow({
        id: 30,
        company_name: 'AutoMatch SRL',
        tax_identification_number: 'RO55555555',
      }),
    ]);

    const result = await service.findMatches({
      name: 'AutoMatch SRL',
      vatCode: 'RO55555555',
      email: '',
      phone: '',
    });

    expect(result.autoMatchSuggestion).not.toBeNull();
    expect(result.autoMatchSuggestion!.customerId).toBe(30);
    expect(result.autoMatchSuggestion!.matchScore).toBeGreaterThanOrEqual(80);
  });

  it('should not suggest auto-match for score < 80', async () => {
    // Only CUI(50) = 50 => no auto-match
    mockDataSource.query.mockResolvedValue([
      buildErpRow({
        id: 31,
        company_name: 'NoAuto SRL',
        tax_identification_number: 'RO66666666',
      }),
    ]);

    const result = await service.findMatches({
      name: 'Completely Different',
      vatCode: 'RO66666666',
      email: '',
      phone: '',
    });

    expect(result.autoMatchSuggestion).toBeNull();
  });

  // ----- Phone normalization helper -----

  it('should normalize Romanian phone numbers correctly', () => {
    expect(normalizePhone('+40 721 123 456')).toBe('721123456');
    expect(normalizePhone('0721-123-456')).toBe('721123456');
    expect(normalizePhone('0721.123.456')).toBe('721123456');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});
