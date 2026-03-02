import { DiscoveredDoc, DocType } from '../types';

const AZZARDO_DOWNLOAD_ZONE_URL = 'https://www.en.azzardo.com/download-zone';

const INSTALLATION_HINTS = [
  'manual',
  'installation',
  'install',
  'guide',
  'instruction',
  'assembly',
  'mounting',
];

const DATASHEET_HINTS = ['data sheet', 'datasheet', 'specification', 'spec sheet', 'technical'];
const DRAWING_HINTS = ['drawing', 'dwg', 'dxf', 'cad', 'technical drawing', 'scheme'];
const IMAGE_HINTS = ['image', 'photo', 'picture', 'render', 'preview'];
const MODEL_3D_HINTS = ['3d', 'model', 'obj', 'fbx', 'glb', 'gltf', 'stl', '3ds'];
const CERTIFICATE_HINTS = ['certificate', 'certification', 'declaration', 'ce', 'rohs', 'ul', 'enec'];
const PHOTOMETRIC_HINTS = ['photometric', 'ies', 'ldt', 'eulumdat'];

export function parseAzzardoDocs(html: string): DiscoveredDoc[] {
  const links = extractAnchorLinks(html);
  const docs: DiscoveredDoc[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const sourceUrl = toAbsoluteUrl(link.href);
    if (!sourceUrl || !isDocumentUrl(sourceUrl)) {
      continue;
    }

    const fileName = getFileNameFromUrl(sourceUrl, link.text);
    const hintText = `${fileName} ${link.text}`.trim();
    const supplierSku = extractSupplierSku(hintText);
    const docType = classifyDocType(hintText);

    if (!docType) {
      continue;
    }

    const resolvedSku = supplierSku ?? 'AZZARDO_COLLECTION';

    const dedupeKey = `${sourceUrl}|${resolvedSku}|${docType}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    docs.push({
      supplier: 'azzardo',
      supplierSku: resolvedSku,
      docType,
      sourceUrl,
      fileName,
    });
  }

  return docs;
}

export async function fetchAzzardoDocs(): Promise<DiscoveredDoc[]> {
  const response = await fetch(AZZARDO_DOWNLOAD_ZONE_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch Azzardo download zone: ${response.status}`);
  }

  const html = await response.text();
  return parseAzzardoDocs(html);
}

interface AnchorLink {
  href: string;
  text: string;
}

function extractAnchorLinks(html: string): AnchorLink[] {
  const links: AnchorLink[] = [];
  const anchorRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const href = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!href) {
      continue;
    }

    const text = stripHtml(match[4] ?? '');
    links.push({ href, text });
  }

  return links;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteUrl(rawHref: string): string | null {
  try {
    return new URL(rawHref, AZZARDO_DOWNLOAD_ZONE_URL).toString();
  } catch {
    return null;
  }
}

function isDocumentUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.includes('dropbox.com') && parsed.pathname.includes('/scl/fo/')) {
      return true;
    }

    return /\.(pdf|doc|docx|dwg|dxf|jpg|jpeg|png|webp|svg|obj|fbx|3ds|stl|glb|gltf|ies|ldt|zip)$/i.test(
      parsed.pathname,
    );
  } catch {
    return false;
  }
}

function getFileNameFromUrl(sourceUrl: string, linkText: string): string {
  try {
    const parsed = new URL(sourceUrl);
    const baseName = parsed.pathname.split('/').filter(Boolean).at(-1);

    if (baseName && /\.[a-z0-9]+$/i.test(baseName)) {
      return decodeURIComponent(baseName);
    }

    if (parsed.hostname.includes('dropbox.com') && parsed.pathname.includes('/scl/fo/')) {
      const normalized = linkText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const fallback = normalized || 'azzardo-collection';
      return `${fallback}.zip`;
    }

    return 'document.pdf';
  } catch {
    return 'document.pdf';
  }
}

function extractSupplierSku(value: string): string | null {
  const match = value.match(/\b(AZ[-_ ]?\d{3,6}[A-Z0-9]*)\b/i);
  if (!match) {
    return null;
  }

  return match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function classifyDocType(value: string): DocType | null {
  const normalized = value.toLowerCase();

  if (PHOTOMETRIC_HINTS.some((hint) => normalized.includes(hint))) {
    return 'photometric_data';
  }

  if (MODEL_3D_HINTS.some((hint) => normalized.includes(hint))) {
    return 'model_3d';
  }

  if (CERTIFICATE_HINTS.some((hint) => normalized.includes(hint))) {
    return 'certificate';
  }

  if (DRAWING_HINTS.some((hint) => normalized.includes(hint))) {
    return 'technical_drawing';
  }

  if (IMAGE_HINTS.some((hint) => normalized.includes(hint))) {
    return 'product_image';
  }

  if (INSTALLATION_HINTS.some((hint) => normalized.includes(hint))) {
    return 'installation_guide';
  }

  if (DATASHEET_HINTS.some((hint) => normalized.includes(hint))) {
    return 'datasheet';
  }

  return null;
}
