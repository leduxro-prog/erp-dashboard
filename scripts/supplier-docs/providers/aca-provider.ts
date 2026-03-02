import { DiscoveredDoc, DocType } from '../types';

const ACA_BASE_URL = 'https://acalight.gr/en/';

const INSTALLATION_HINTS = ['manual', 'installation', 'install', 'guide', 'instruction', 'mounting'];

const DATASHEET_HINTS = ['data sheet', 'datasheet', 'specification', 'spec sheet', 'technical'];

interface AnchorLink {
  href: string;
  text: string;
}

interface CandidateProductPage {
  url: string;
  html: string;
  hasSku: boolean;
}

export function parseAcaProductDocs(html: string, supplierSku: string): DiscoveredDoc[] {
  const normalizedSku = normalizeSku(supplierSku);
  const links = extractAnchorLinks(html);
  const docs: DiscoveredDoc[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const sourceUrl = toAbsoluteUrl(link.href);
    if (!sourceUrl || !isDocumentUrl(sourceUrl)) {
      continue;
    }

    const fileName = getFileNameFromUrl(sourceUrl);
    const hintText = `${fileName} ${link.text}`.trim();
    const docType = classifyDocType(hintText);

    if (!docType) {
      continue;
    }

    const dedupeKey = `${sourceUrl}|${normalizedSku}|${docType}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    docs.push({
      supplier: 'aca',
      supplierSku: normalizedSku,
      docType,
      sourceUrl,
      fileName,
    });
  }

  return docs;
}

export function buildAcaSearchUrl(supplierSku: string): string {
  const url = new URL(ACA_BASE_URL);
  url.searchParams.set('s', supplierSku);
  url.searchParams.set('post_type', 'product');
  return url.toString();
}

export function parseAcaSearchProductUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const link of extractAnchorLinks(html)) {
    const absolute = toAbsoluteUrl(link.href);
    if (!absolute || !isLikelyProductUrl(absolute)) {
      continue;
    }

    if (!seen.has(absolute)) {
      seen.add(absolute);
      urls.push(absolute);
    }
  }

  return urls;
}

export async function fetchAcaSearchProductUrls(supplierSku: string): Promise<string[]> {
  const response = await fetch(buildAcaSearchUrl(supplierSku));
  if (!response.ok) {
    throw new Error(`Failed to fetch ACA search results: ${response.status}`);
  }

  const html = await response.text();
  return parseAcaSearchProductUrls(html);
}

export async function fetchAcaDocsForSku(supplierSku: string): Promise<DiscoveredDoc[]> {
  const candidateUrls = await fetchAcaSearchProductUrls(supplierSku);
  const pages = await fetchCandidatePages(candidateUrls, supplierSku);
  const selectedPages = pages.some((page) => page.hasSku)
    ? pages.filter((page) => page.hasSku)
    : pages;

  const docs: DiscoveredDoc[] = [];
  const seen = new Set<string>();

  for (const page of selectedPages) {
    for (const doc of parseAcaProductDocs(page.html, supplierSku)) {
      const dedupeKey = `${doc.sourceUrl}|${doc.supplierSku}|${doc.docType}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      docs.push(doc);
    }
  }

  return docs;
}

async function fetchCandidatePages(urls: string[], supplierSku: string): Promise<CandidateProductPage[]> {
  const pages: CandidateProductPage[] = [];

  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    pages.push({
      url,
      html,
      hasSku: containsSku(html, supplierSku),
    });
  }

  return pages;
}

function containsSku(html: string, supplierSku: string): boolean {
  const normalizedBody = normalizeSku(stripHtml(html));
  const normalizedSku = normalizeSku(supplierSku);
  if (!normalizedSku) {
    return false;
  }

  return normalizedBody.includes(normalizedSku);
}

function extractAnchorLinks(html: string): AnchorLink[] {
  const links: AnchorLink[] = [];
  const anchorRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const href = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!href) {
      continue;
    }

    links.push({ href, text: stripHtml(match[4] ?? '') });
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
    return new URL(rawHref, ACA_BASE_URL).toString();
  } catch {
    return null;
  }
}

function isLikelyProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== 'acalight.gr' && hostname !== 'www.acalight.gr') {
      return false;
    }

    return /\/product\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isDocumentUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return /\.(pdf|doc|docx)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function getFileNameFromUrl(sourceUrl: string): string {
  try {
    const parsed = new URL(sourceUrl);
    const baseName = parsed.pathname.split('/').filter(Boolean).at(-1) ?? 'document.pdf';
    return decodeURIComponent(baseName);
  } catch {
    return 'document.pdf';
  }
}

function normalizeSku(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function classifyDocType(value: string): DocType | null {
  const normalized = value.toLowerCase();

  if (INSTALLATION_HINTS.some((hint) => normalized.includes(hint))) {
    return 'installation_guide';
  }

  if (DATASHEET_HINTS.some((hint) => normalized.includes(hint))) {
    return 'datasheet';
  }

  return null;
}
