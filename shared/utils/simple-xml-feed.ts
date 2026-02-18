export interface ParsedXmlFeedRow {
  sku: string;
  name?: string;
  ean?: string;
  quantity?: number;
  price?: number;
  leadTimeDays?: number;
  minOrderQty?: number;
}

const ITEM_TAG_CANDIDATES = ['item', 'product', 'row', 'record', 'pozycja', 'towar'];
const SKU_TAGS = ['sku', 'code', 'kod', 'symbol', 'index', 'productcode', 'supplier_sku'];
const NAME_TAGS = ['name', 'nume', 'denumire', 'product_name', 'nazwa', 'opis'];
const EAN_TAGS = ['ean', 'barcode', 'kodkreskowy'];
const QTY_TAGS = ['quantity', 'qty', 'stock', 'stoc', 'available', 'disponibil', 'ilosc'];
const PRICE_TAGS = ['price', 'pret', 'net_price', 'cena', 'cost'];
const LEAD_TIME_TAGS = ['lead_time', 'lead_time_days', 'delivery_days', 'termen_livrare'];
const MIN_QTY_TAGS = ['min_order_qty', 'min_qty', 'moq', 'minimum_order'];

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function parseNumber(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = parseFloat(raw.replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getTagValue(block: string, tags: string[]): string | undefined {
  for (const tag of tags) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = block.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  const tagMatches = [...block.matchAll(/<([a-zA-Z0-9_:-]+)[^>]*>([\s\S]*?)<\/\1>/g)];
  for (const [, rawTag, value] of tagMatches) {
    const normalized = normalizeTag(rawTag);
    if (tags.includes(normalized)) {
      return value.trim();
    }
  }

  return undefined;
}

function detectItemTag(xml: string): string | undefined {
  let bestTag: string | undefined;
  let bestCount = 0;

  for (const tag of ITEM_TAG_CANDIDATES) {
    const openRegex = new RegExp(`<${tag}(\\s|>)`, 'gi');
    const count = (xml.match(openRegex) || []).length;
    if (count > bestCount) {
      bestTag = tag;
      bestCount = count;
    }
  }

  return bestCount > 0 ? bestTag : undefined;
}

export function parseSimpleXmlFeed(xml: string): ParsedXmlFeedRow[] {
  const itemTag = detectItemTag(xml);
  if (!itemTag) {
    return [];
  }

  const blockRegex = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, 'gi');
  const rows: ParsedXmlFeedRow[] = [];

  for (const match of xml.matchAll(blockRegex)) {
    const block = match[1] || '';
    const sku = getTagValue(block, SKU_TAGS);
    if (!sku) {
      continue;
    }

    const quantity = parseNumber(getTagValue(block, QTY_TAGS));
    const price = parseNumber(getTagValue(block, PRICE_TAGS));
    const leadTimeDays = parseNumber(getTagValue(block, LEAD_TIME_TAGS));
    const minOrderQty = parseNumber(getTagValue(block, MIN_QTY_TAGS));

    rows.push({
      sku: sku.trim(),
      name: getTagValue(block, NAME_TAGS),
      ean: getTagValue(block, EAN_TAGS),
      quantity: quantity !== undefined ? Math.max(0, Math.floor(quantity)) : undefined,
      price,
      leadTimeDays: leadTimeDays !== undefined ? Math.max(0, Math.floor(leadTimeDays)) : undefined,
      minOrderQty: minOrderQty !== undefined ? Math.max(1, Math.floor(minOrderQty)) : undefined,
    });
  }

  return rows;
}
