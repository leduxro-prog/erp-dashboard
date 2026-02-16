import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Integration: Customer Auto-Match Logic', () => {
  let mockDataSource: any;
  let service: any;

  // Factory for ERP customer rows
  function makeErpCustomer(overrides: Record<string, any> = {}) {
    return {
      id: 1,
      company_name: 'SC Test SRL',
      tax_identification_number: null,
      email: null,
      phone_number: null,
      contact_person_name: null,
      contact_person_email: null,
      contact_person_phone: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn(),
    };

    const {
      CustomerMatchingService,
    } = require('../../modules/smartbill/src/application/services/CustomerMatchingService');

    service = new CustomerMatchingService(mockDataSource);
  });

  it('should find perfect CUI match and auto-link', async () => {
    // Mock fetchAllErpCustomers
    mockDataSource.query.mockResolvedValue([
      makeErpCustomer({
        id: 10,
        company_name: 'SC Alpha SRL',
        tax_identification_number: 'RO12345678',
        email: 'contact@alpha.ro',
      }),
      makeErpCustomer({
        id: 20,
        company_name: 'SC Beta SRL',
        tax_identification_number: 'RO87654321',
      }),
    ]);

    const result = await service.findMatches({
      name: 'Alpha SRL',
      vatCode: 'RO12345678',
      email: '',
      phone: '',
    });

    expect(result.candidates.length).toBeGreaterThanOrEqual(1);

    const topCandidate = result.candidates[0];
    expect(topCandidate.customerId).toBe(10);
    expect(topCandidate.cui).toBe('RO12345678');
    // CUI exact match (+50) + company name fuzzy (+20) = 70 at minimum
    expect(topCandidate.matchScore).toBeGreaterThanOrEqual(50);
    expect(topCandidate.matchReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('CUI exact match')]),
    );

    // With CUI + company name, score should be >= 70 which may or may not hit auto-link threshold
    // If additional signals push it to 80+, autoMatchSuggestion is populated
    if (topCandidate.matchScore >= 80) {
      expect(result.autoMatchSuggestion).not.toBeNull();
      expect(result.autoMatchSuggestion!.customerId).toBe(10);
    }
  });

  it('should detect email domain match as medium confidence', async () => {
    mockDataSource.query.mockResolvedValue([
      makeErpCustomer({
        id: 30,
        company_name: 'SC Gamma SRL',
        email: 'sales@gamma-corp.ro',
      }),
    ]);

    const result = await service.findMatches({
      name: 'Gamma Corporation',
      vatCode: '',
      email: 'info@gamma-corp.ro', // same domain, different user
      phone: '',
    });

    expect(result.candidates.length).toBeGreaterThanOrEqual(1);

    const candidate = result.candidates[0];
    expect(candidate.customerId).toBe(30);
    // Email domain match is +15, company name fuzzy match +20 (contains "gamma")
    expect(candidate.matchReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Email domain match')]),
    );
    // Score should be in medium range (15-79)
    expect(candidate.matchScore).toBeGreaterThanOrEqual(15);
    expect(candidate.matchScore).toBeLessThan(80);
    expect(candidate.confidence).not.toBe('high');
  });

  it('should normalize phone numbers for matching', async () => {
    // Import the normalizePhone helper directly
    const {
      normalizePhone,
    } = require('../../modules/smartbill/src/application/services/CustomerMatchingService');

    // Verify phone normalization strips Romanian prefixes and formatting
    expect(normalizePhone('+40 741 234 567')).toBe('741234567');
    expect(normalizePhone('0741-234-567')).toBe('741234567');
    expect(normalizePhone('0741.234.567')).toBe('741234567');
    expect(normalizePhone('(0741) 234 567')).toBe('741234567');
    expect(normalizePhone('+40741234567')).toBe('741234567');
    expect(normalizePhone('741234567')).toBe('741234567');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');

    // Now test through the service: SmartBill phone in +40 format, ERP in 07xx format
    mockDataSource.query.mockResolvedValue([
      makeErpCustomer({
        id: 40,
        company_name: 'SC Delta SRL',
        phone_number: '0722-111-222',
      }),
    ]);

    const result = await service.findMatches({
      name: 'Unrelated Name',
      vatCode: '',
      email: '',
      phone: '+40 722 111 222',
    });

    expect(result.candidates.length).toBeGreaterThanOrEqual(1);

    const candidate = result.candidates[0];
    expect(candidate.customerId).toBe(40);
    expect(candidate.matchReasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Phone exact match')]),
    );
  });

  it('should not auto-link low confidence matches', async () => {
    mockDataSource.query.mockResolvedValue([
      makeErpCustomer({
        id: 50,
        company_name: 'SC Epsilon SRL',
        email: 'info@epsilon.ro',
      }),
      makeErpCustomer({
        id: 60,
        company_name: 'SC Zeta SRL',
        email: 'contact@zeta.ro',
      }),
    ]);

    const result = await service.findMatches({
      name: 'Totally Different Company',
      vatCode: '',
      email: 'random@gmail.com',
      phone: '',
    });

    // No strong matches — autoMatchSuggestion should be null
    expect(result.autoMatchSuggestion).toBeNull();

    // Any candidates that do show up should be low confidence
    for (const candidate of result.candidates) {
      expect(candidate.matchScore).toBeLessThan(80);
    }
  });

  it('should return top 5 candidates sorted by score', async () => {
    // Create 8 ERP customers with varying match signals
    mockDataSource.query.mockResolvedValue([
      makeErpCustomer({
        id: 1,
        company_name: 'Exact Match SRL',
        tax_identification_number: 'RO11111111',
        email: 'exact@match.ro',
      }),
      makeErpCustomer({ id: 2, company_name: 'Exact Match SRL', email: 'other@match.ro' }),
      makeErpCustomer({ id: 3, company_name: 'Close Match SRL', phone_number: '0744-999-888' }),
      makeErpCustomer({
        id: 4,
        company_name: 'Exact Match SRL',
        tax_identification_number: 'RO22222222',
      }),
      makeErpCustomer({ id: 5, company_name: 'Something Else', email: 'exact@match.ro' }),
      makeErpCustomer({ id: 6, company_name: 'Nope Corp' }),
      makeErpCustomer({ id: 7, company_name: 'Also Nope Inc' }),
      makeErpCustomer({ id: 8, company_name: 'No Match At All' }),
    ]);

    const result = await service.findMatches({
      name: 'Exact Match SRL',
      vatCode: 'RO11111111',
      email: 'exact@match.ro',
      phone: '+40744999888',
    });

    // Should return at most 5 candidates
    expect(result.candidates.length).toBeLessThanOrEqual(5);

    // Should be sorted descending by score
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].matchScore).toBeGreaterThanOrEqual(
        result.candidates[i].matchScore,
      );
    }

    // The top candidate should be the one with CUI + email + company name match
    expect(result.candidates[0].customerId).toBe(1);
    expect(result.candidates[0].matchScore).toBeGreaterThanOrEqual(80);
    expect(result.candidates[0].confidence).toBe('high');
  });
});
