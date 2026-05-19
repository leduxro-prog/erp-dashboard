import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveRuntimeBranding } from '../../utils/runtime-branding';

const ensureMetaByName = (name: string): HTMLMetaElement => {
  let element = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }

  return element;
};

const ensureMetaByProperty = (property: string): HTMLMetaElement => {
  let element = document.head.querySelector(
    `meta[property="${property}"]`,
  ) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }

  return element;
};

const ensureLink = (rel: string): HTMLLinkElement => {
  let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  return element;
};

const buildCanonicalUrl = (canonicalBase: string, pathname: string): string => {
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(normalizedPathname, canonicalBase).toString();
};

export const RuntimeHead = () => {
  const location = useLocation();

  const branding = useMemo(
    () =>
      resolveRuntimeBranding({
        hostname: typeof window === 'undefined' ? '' : window.location.hostname,
        pathname: location.pathname,
      }),
    [location.pathname],
  );

  useEffect(() => {
    document.title = branding.title;

    ensureMetaByName('description').setAttribute('content', branding.description);
    ensureMetaByName('theme-color').setAttribute('content', branding.themeColor);
    ensureMetaByName('application-name').setAttribute('content', branding.siteName);
    ensureMetaByName('twitter:card').setAttribute('content', 'summary');
    ensureMetaByName('twitter:title').setAttribute('content', branding.title);
    ensureMetaByName('twitter:description').setAttribute('content', branding.description);

    ensureMetaByProperty('og:type').setAttribute('content', 'website');
    ensureMetaByProperty('og:site_name').setAttribute('content', branding.siteName);
    ensureMetaByProperty('og:title').setAttribute('content', branding.title);
    ensureMetaByProperty('og:description').setAttribute('content', branding.description);
    ensureMetaByProperty('og:url').setAttribute(
      'content',
      buildCanonicalUrl(branding.canonicalBase, location.pathname),
    );

    ensureLink('canonical').setAttribute(
      'href',
      buildCanonicalUrl(branding.canonicalBase, location.pathname),
    );
    ensureLink('icon').setAttribute('href', branding.iconHref);
    ensureLink('apple-touch-icon').setAttribute('href', branding.appleTouchIconHref);
    ensureLink('manifest').setAttribute('href', branding.manifestHref);
  }, [branding, location.pathname]);

  return null;
};

export default RuntimeHead;
