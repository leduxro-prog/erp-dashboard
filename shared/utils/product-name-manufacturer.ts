function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function ensureManufacturerInProductName(name: string, manufacturer: string): string {
  const normalizedName = normalizeSpaces(name || '');
  const normalizedManufacturer = normalizeSpaces(manufacturer || '');

  if (!normalizedName || !normalizedManufacturer) {
    return normalizedName;
  }

  const manufacturerPattern = new RegExp(`\\b${escapeRegExp(normalizedManufacturer)}\\b`, 'i');
  if (manufacturerPattern.test(normalizedName)) {
    return normalizedName;
  }

  return `${normalizedManufacturer} ${normalizedName}`;
}

export function isAzzardoSupplier(supplierName?: string, supplierCode?: string): boolean {
  const name = (supplierName || '').toLowerCase();
  const code = (supplierCode || '').toLowerCase();
  return name.includes('azzardo') || code.includes('azzardo');
}
