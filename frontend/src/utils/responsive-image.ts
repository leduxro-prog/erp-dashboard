export interface ResponsiveImageSources {
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrcSet: string;
  fallbackSrc: string;
}

const DEFAULT_WIDTHS = [320, 480, 640, 768, 960, 1200, 1600];

function encodePathSegments(imageUrl: string): string {
  return imageUrl
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getFallbackFormat(imageUrl: string): 'jpeg' | 'png' {
  const lower = imageUrl.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'png';
  }

  return 'jpeg';
}

export function buildResponsiveImageSources(
  imageUrl: string,
  options?: {
    widths?: number[];
    quality?: number;
  },
): ResponsiveImageSources | null {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) {
    return null;
  }

  const normalizedWidths = (options?.widths || DEFAULT_WIDTHS)
    .map((width) => Math.round(width))
    .filter((width) => Number.isFinite(width) && width > 0);

  if (normalizedWidths.length === 0) {
    return null;
  }

  const quality = Number.isFinite(Number(options?.quality)) ? Number(options?.quality) : 72;
  const encodedPath = encodePathSegments(imageUrl.replace(/^\/uploads\//, ''));
  const optimizedBase = `/uploads/optimized/${encodedPath}`;

  const buildSet = (format: 'avif' | 'webp' | 'jpeg' | 'png') =>
    normalizedWidths
      .map((width) => `${optimizedBase}?w=${width}&fmt=${format}&q=${quality} ${width}w`)
      .join(', ');

  const fallbackFormat = getFallbackFormat(imageUrl);

  return {
    avifSrcSet: buildSet('avif'),
    webpSrcSet: buildSet('webp'),
    fallbackSrcSet: buildSet(fallbackFormat),
    fallbackSrc: imageUrl,
  };
}
