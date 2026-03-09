import {
  isB2BPublicStorePath,
  resolveB2BStorePath,
  resolveRuntimeBranding,
} from '../../../utils/runtime-branding';

describe('resolveRuntimeBranding', () => {
  it('uses ERP branding on erp.ledux.ro routes', () => {
    const branding = resolveRuntimeBranding({
      hostname: 'erp.ledux.ro',
      pathname: '/dashboard',
    });

    expect(branding.identity).toBe('erp');
    expect(branding.title).toBe('Ledux ERP');
    expect(branding.description).toBe(
      'Ledux ERP pentru operatiuni interne, vanzari, inventar, comenzi si administrare B2B.',
    );
    expect(branding.themeColor).toBe('#111827');
    expect(branding.iconHref).toBe('/erp/favicon.svg');
    expect(branding.manifestHref).toBe('/erp/manifest.webmanifest');
  });

  it('uses B2B branding on b2b.ledux.ro storefront routes', () => {
    const branding = resolveRuntimeBranding({
      hostname: 'b2b.ledux.ro',
      pathname: '/catalog',
    });

    expect(branding.identity).toBe('b2b');
    expect(branding.title).toBe('Ledux B2B');
    expect(branding.description).toBe(
      'Portalul B2B Ledux pentru catalog profesional, comenzi corporate si acces parteneri.',
    );
    expect(branding.themeColor).toBe('#b8860b');
    expect(branding.iconHref).toBe('/b2b/favicon.svg');
    expect(branding.manifestHref).toBe('/b2b/manifest.webmanifest');
  });

  it('keeps B2B branding for portal routes even under the ERP host', () => {
    const branding = resolveRuntimeBranding({
      hostname: 'erp.ledux.ro',
      pathname: '/b2b-portal/dashboard',
    });

    expect(branding.identity).toBe('b2b');
    expect(branding.title).toBe('Ledux B2B');
    expect(branding.iconHref).toBe('/b2b/favicon.svg');
    expect(branding.manifestHref).toBe('/b2b/manifest.webmanifest');
  });

  it('uses host-level B2B storefront paths on b2b.ledux.ro', () => {
    expect(resolveB2BStorePath('/', 'b2b.ledux.ro')).toBe('/');
    expect(resolveB2BStorePath('/catalog', 'b2b.ledux.ro')).toBe('/catalog');
    expect(resolveB2BStorePath('/login', 'b2b.ledux.ro')).toBe('/login');
    expect(resolveB2BStorePath('/product/42', 'b2b.ledux.ro')).toBe('/product/42');
  });

  it('keeps prefixed B2B storefront paths outside the dedicated B2B host', () => {
    expect(resolveB2BStorePath('/catalog', 'erp.ledux.ro')).toBe('/b2b-store/catalog');
    expect(resolveB2BStorePath('/login', 'ledux.ro')).toBe('/b2b-store/login');
    expect(resolveB2BStorePath('/product/42', '127.0.0.1')).toBe('/b2b-store/product/42');
  });

  it('only treats dedicated-host storefront paths as public B2B pages on b2b.ledux.ro', () => {
    expect(isB2BPublicStorePath('/catalog', 'b2b.ledux.ro')).toBe(true);
    expect(isB2BPublicStorePath('/login', 'b2b.ledux.ro')).toBe(true);
    expect(isB2BPublicStorePath('/product/42', 'b2b.ledux.ro')).toBe(true);
    expect(isB2BPublicStorePath('/dashboard', 'b2b.ledux.ro')).toBe(false);
    expect(isB2BPublicStorePath('/catalog', 'ledux.ro')).toBe(false);
  });
});
