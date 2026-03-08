import { describe, expect, it } from '@jest/globals';
import { SeoEligibilityFingerprintService } from '../../src/domain/services/SeoEligibilityFingerprintService';

describe('SeoEligibilityFingerprintService', () => {
  const service = new SeoEligibilityFingerprintService();

  const completeSeo = {
    metaTitle: '  Bec LED 10W  ',
    metaDescription: ' Lumina calda cu consum redus pentru casa. ',
    slug: ' bec-led-10w ',
    focusKeyword: ' Bec LED ',
  };

  it('detects NEW when there is no applied fingerprint', () => {
    const result = service.evaluate({
      seo: completeSeo,
      lastAppliedFingerprint: null,
    });

    expect(result.status).toBe('NEW');
    expect(result.fingerprint).toBeTruthy();
    expect(result.missingFields).toEqual([]);
  });

  it('detects MISSING when required SEO fields are absent', () => {
    const result = service.evaluate({
      seo: {
        metaTitle: 'Valid title',
        metaDescription: ' ',
        slug: '',
      },
      lastAppliedFingerprint: null,
    });

    expect(result.status).toBe('MISSING');
    expect(result.fingerprint).toBeNull();
    expect(result.missingFields).toEqual(['metaDescription', 'slug']);
  });

  it('detects MODIFIED when fingerprint differs from last applied', () => {
    const currentFingerprint = service.createFingerprint(completeSeo);

    const result = service.evaluate({
      seo: completeSeo,
      lastAppliedFingerprint: `${currentFingerprint}-old`,
    });

    expect(result.status).toBe('MODIFIED');
    expect(result.fingerprint).toBe(currentFingerprint);
  });

  it('detects UNCHANGED when fingerprint matches last applied', () => {
    const fingerprint = service.createFingerprint(completeSeo);

    const result = service.evaluate({
      seo: completeSeo,
      lastAppliedFingerprint: fingerprint,
    });

    expect(result.status).toBe('UNCHANGED');
    expect(result.fingerprint).toBe(fingerprint);
    expect(result.missingFields).toEqual([]);
  });

  it('creates stable fingerprint for same normalized input', () => {
    const fp1 = service.createFingerprint({
      metaTitle: 'Bec LED 10W',
      metaDescription: 'Lumina calda cu consum redus pentru casa.',
      slug: 'bec-led-10w',
      focusKeyword: 'bec LED',
    });

    const fp2 = service.createFingerprint({
      metaTitle: '  bec led 10w  ',
      metaDescription: 'Lumina   calda   cu consum redus pentru casa.',
      slug: 'BEC-LED-10W',
      focusKeyword: ' BEC led ',
    });

    expect(fp1).toBe(fp2);
  });

  it('changes fingerprint when relevant SEO fields change', () => {
    const base = service.createFingerprint({
      metaTitle: 'Bec LED 10W',
      metaDescription: 'Lumina calda cu consum redus pentru casa.',
      slug: 'bec-led-10w',
      focusKeyword: 'bec LED',
    });

    const changed = service.createFingerprint({
      metaTitle: 'Bec LED 10W',
      metaDescription: 'Lumina rece cu consum redus pentru birou.',
      slug: 'bec-led-10w',
      focusKeyword: 'bec LED',
    });

    expect(changed).not.toBe(base);
  });
});
