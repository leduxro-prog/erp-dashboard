export function resolveSupplierLeadTimeLabel(
  supplierName?: string | null,
  supplierLeadTime?: number | string | null,
  supplierLeadTimeLabel?: string | null,
  brand?: string | null,
  manufacturer?: string | null,
): string {
  const explicitLabel = String(supplierLeadTimeLabel || '').trim();
  if (explicitLabel) {
    return explicitLabel.replace(/\s*zile(?:\s+lucratoare)?\s*$/i, '').trim();
  }

  const numericDays = Number(supplierLeadTime);
  if (Number.isFinite(numericDays) && numericDays > 0) {
    return String(Math.ceil(numericDays));
  }

  const supplierText = [supplierName, brand, manufacturer]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');

  if (supplierText.includes('mpl power')) {
    return '3-5';
  }

  return '2-3';
}

export default resolveSupplierLeadTimeLabel;
