export type RuntimeIdentity = 'erp' | 'b2b';

export interface RuntimeBrandingInput {
  hostname?: string;
  pathname?: string;
}

export interface RuntimeBranding {
  identity: RuntimeIdentity;
  siteName: string;
  title: string;
  description: string;
  themeColor: string;
  iconHref: string;
  appleTouchIconHref: string;
  manifestHref: string;
  canonicalBase: string;
}

const ERP_HOST = 'erp.ledux.ro';
const B2B_HOST = 'b2b.ledux.ro';
const B2B_STORE_PREFIX = '/b2b-store';

const B2B_PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/about',
  '/catalog',
  '/checkout',
  '/contact',
  '/cookies',
  '/forgot-password',
  '/how-to-order',
  '/led-guide',
  '/login',
  '/partner',
  '/privacy',
  '/register',
  '/request-quote',
  '/reset-password',
  '/shipping',
  '/terms',
]);

const ERP_BRANDING: RuntimeBranding = {
  identity: 'erp',
  siteName: 'Ledux ERP',
  title: 'Ledux ERP',
  description: 'Ledux ERP pentru operatiuni interne, vanzari, inventar, comenzi si administrare B2B.',
  themeColor: '#111827',
  iconHref: '/erp/favicon.svg',
  appleTouchIconHref: '/erp/apple-touch-icon.png',
  manifestHref: '/erp/manifest.webmanifest',
  canonicalBase: 'https://erp.ledux.ro',
};

const B2B_BRANDING: RuntimeBranding = {
  identity: 'b2b',
  siteName: 'Ledux B2B',
  title: 'Ledux B2B',
  description: 'Portalul B2B Ledux pentru catalog profesional, comenzi corporate si acces parteneri.',
  themeColor: '#b8860b',
  iconHref: '/b2b/favicon.svg',
  appleTouchIconHref: '/b2b/apple-touch-icon.png',
  manifestHref: '/b2b/manifest.webmanifest',
  canonicalBase: 'https://b2b.ledux.ro',
};

const normalizeHostname = (hostname?: string): string => String(hostname || '').trim().toLowerCase();

const normalizePathname = (pathname?: string): string => {
  const rawPathname = String(pathname || '/').trim() || '/';
  return rawPathname.startsWith('/') ? rawPathname : `/${rawPathname}`;
};

const normalizeB2BStoreSubpath = (pathname?: string): string => {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === B2B_STORE_PREFIX || normalizedPathname === `${B2B_STORE_PREFIX}/`) {
    return '/';
  }

  if (normalizedPathname.startsWith(`${B2B_STORE_PREFIX}/`)) {
    return normalizePathname(normalizedPathname.slice(B2B_STORE_PREFIX.length));
  }

  return normalizedPathname;
};

export const isDedicatedB2BHost = (hostname?: string): boolean =>
  normalizeHostname(hostname) === B2B_HOST;

export const resolveB2BStorePath = (pathname?: string, hostname?: string): string => {
  const normalizedSubpath = normalizeB2BStoreSubpath(pathname);

  if (isDedicatedB2BHost(hostname)) {
    return normalizedSubpath;
  }

  return normalizedSubpath === '/' ? B2B_STORE_PREFIX : `${B2B_STORE_PREFIX}${normalizedSubpath}`;
};

export const isB2BPublicStorePath = (pathname?: string, hostname?: string): boolean => {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedSubpath = normalizeB2BStoreSubpath(pathname);

  if (normalizedPathname.startsWith(`${B2B_STORE_PREFIX}/`) || normalizedPathname === B2B_STORE_PREFIX) {
    return true;
  }

  if (!isDedicatedB2BHost(hostname)) {
    return normalizedPathname === '/checkout';
  }

  return (
    B2B_PUBLIC_EXACT_PATHS.has(normalizedSubpath) || normalizedSubpath.startsWith('/product/')
  );
};

export const isB2BRouteFamily = (pathname?: string, hostname?: string): boolean => {
  const normalizedPathname = normalizePathname(pathname);

  return isB2BPublicStorePath(normalizedPathname, hostname) || normalizedPathname.startsWith('/b2b-portal');
};

export const resolveRuntimeBranding = (input: RuntimeBrandingInput = {}): RuntimeBranding => {
  const hostname = normalizeHostname(input.hostname);
  const pathname = normalizePathname(input.pathname);

  if (hostname === B2B_HOST || isB2BRouteFamily(pathname, hostname)) {
    return B2B_BRANDING;
  }

  if (hostname === ERP_HOST) {
    return ERP_BRANDING;
  }

  return ERP_BRANDING;
};
