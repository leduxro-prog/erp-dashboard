import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  Heart,
  Share2,
  Download,
  Package,
  Truck,
  Shield,
  Zap,
  Loader,
  FileText,
  ChevronRight,
  Minus,
  Plus,
  X,
  Eye,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';
import { trackViewItem } from '../../services/retargeting';
import {
  getB2BProductGallery,
  getB2BProductResources,
  type ProductGalleryImage,
} from '../../types/product';
import { resolveB2BStorePath } from '../../utils/runtime-branding';
import { resolveSupplierLeadTimeLabel } from '../../utils/supplierLeadTime';

interface Product {
  id: number;
  name: string;
  sku: string;
  product_code?: string | null;
  ean?: string | null;
  description: string;
  price: number;
  currency: string;
  image_url: string;
  stock_local: number;
  stock_supplier: number;
  stock_total?: number;
  supplier_lead_time: number;
  supplier_lead_time_label?: string;
  supplier_name?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  rating?: number;
  category?: string;
  specifications?: Record<string, any> | null;
}

type ResourcePreviewType = 'pdf' | 'image' | null;

const getResourcePreviewType = (url: string): ResourcePreviewType => {
  try {
    const pathname = new URL(url, window.location.origin).pathname.toLowerCase();
    if (pathname.endsWith('.pdf')) {
      return 'pdf';
    }

    if (/(\.png|\.jpg|\.jpeg|\.webp|\.gif|\.svg)$/.test(pathname)) {
      return 'image';
    }
  } catch {
    return null;
  }

  return null;
};

const getSupplierStockDetail = (
  product: Product,
): { available: boolean; quantityText: string; color: string } | null => {
  const supplierName = String(product.supplier_name || '').toLowerCase();
  const isMplSupplier = supplierName.includes('mpl power');

  if (isMplSupplier) {
    const available = product.stock_supplier > 0;
    return {
      available,
      quantityText: available ? 'Disponibil' : 'Indisponibil',
      color: available ? '#daa520' : '#ef4444',
    };
  }

  if (product.stock_supplier <= 0) {
    return null;
  }

  return {
    available: true,
    quantityText: `${product.stock_supplier} buc`,
    color: '#daa520',
  };
};

const parseSpecs = (product: Product) => {
  const apiSpecs = (product.specifications || {}) as Record<string, any>;
  const text = `${product.name} ${product.description}`.toLowerCase();
  const wattMatch = text.match(/(\d+)\s*w(?:att)?/i);
  const kelvinMatch = text.match(/(\d{4})\s*k/i);
  const ipMatch = text.match(/ip\s*(\d{2})/i);
  const lumenMatch = text.match(/(\d+)\s*(?:lm|lumen)/i);

  const watt = apiSpecs.wattage || (wattMatch ? wattMatch[1] : '—');
  const kelvin = apiSpecs.color_temperature || (kelvinMatch ? kelvinMatch[1] : '—');
  const ip = apiSpecs.ip_rating || apiSpecs.protection_class || (ipMatch ? `IP${ipMatch[1]}` : '—');
  const lumen = apiSpecs.lumens || (lumenMatch ? lumenMatch[1] : '—');

  return {
    watt,
    kelvin,
    ip,
    lumen,
    productCode: apiSpecs.product_code || product.product_code || product.sku || '—',
    ean: apiSpecs.ean || product.ean || '—',
    cri: apiSpecs.cri || apiSpecs.cri_ra || '—',
    beamAngle: apiSpecs.beam_angle || '—',
    voltageInput: apiSpecs.voltage_input || '—',
    mountingType: apiSpecs.mounting_type || '—',
    brand:
      apiSpecs.manufacturer ||
      apiSpecs.brand ||
      product.manufacturer ||
      product.brand ||
      product.supplier_name ||
      '—',
  };
};

const parseProductResources = (product: Product) => getB2BProductResources(product);

const parseAdditionalSpecs = (product: Product): Array<{ label: string; value: string }> => {
  const specs = (product.specifications || {}) as Record<string, any>;
  const customSpecs = (specs.custom_specs || {}) as Record<string, any>;

  const supplierSpecBlocks: Array<Record<string, unknown>> = [];
  for (const [key, value] of Object.entries(customSpecs)) {
    if (key.toLowerCase().startsWith('specificatii_') && value && typeof value === 'object') {
      supplierSpecBlocks.push(value as Record<string, unknown>);
    }
  }

  if (supplierSpecBlocks.length === 0) {
    for (const [key, value] of Object.entries(customSpecs)) {
      if (value && typeof value === 'object') {
        continue;
      }
      supplierSpecBlocks.push({ [key]: value as unknown });
    }
  }

  const excludedKeys = new Set([
    'nazwa_erp_xl',
    'code',
    'ean',
    'technical_sheets',
    'technical_drawings',
    'installation_instructions',
    'product_photo',
    'photo_folder',
    'ce_pl',
    'ce_eng',
    'link_do_karty',
    'supplierdocs',
    'resurse_azzardo',
    'resurse_maytoni',
    'resurse_aca',
    'model_3d_360',
    'toate_linkurile',
    'media_folder_links',
    'toate_campurile_non_url',
    'nume_de',
    'nume_en',
    'nume_es',
    'nume_fr',
    'nume_it',
    'nume_pl',
  ]);

  const labelByKey: Record<string, string> = {
    cri_ra: 'CRI',
    protection_class: 'Grad de protectie',
    ip_rating: 'Grad de protectie',
    grade_of_protection: 'Grad de protectie',
    grad_protectie: 'Grad de protectie',
    beam_angle: 'Unghi fascicul',
    max_power: 'Putere maxima',
    power: 'Putere',
    wattage: 'Putere',
    voltage: 'Tensiune alimentare',
    voltage_input: 'Tensiune alimentare',
    input_voltage: 'Tensiune alimentare',
    dimmable: 'Reglare intensitate',
    electric_shock_class: 'Clasa protectie electrica',
    energy_efficiency: 'Clasa energetica',
    energy_class: 'Clasa energetica',
    type_of_light_source: 'Tip sursa lumina',
    light_source_type: 'Tip sursa lumina',
    light_sources: 'Numar surse lumina',
    number_of_light_sources: 'Numar surse lumina',
    destination: 'Destinatie',
    brand: 'Producator',
    serie: 'Serie',
    stil: 'Stil',
    tip_produs: 'Tip produs',
    colectie: 'Colectie',
    cod_produs_maytoni: 'Cod produs',
    cod_bare: 'EAN',
    cod_bare_pachet: 'EAN pachet',
    cod_hs: 'Cod HS',
    cod_eprel: 'Cod EPREL',
    grad_protectie_ip: 'Grad de protectie',
    clasa_protectie: 'Clasa protectie electrica',
    indice_redare_culoare_ra: 'CRI',
    flux_luminos_lm: 'Flux luminos',
    temperatura_culoare_k: 'Temperatura culoare',
    unghi_dispersie_grade: 'Unghi fascicul',
    putere_bec_w: 'Putere',
    clasa_eficienta_energetica: 'Clasa energetica',
    tensiune: 'Tensiune alimentare',
    material_corp: 'Material corp',
    culoare_corp: 'Culoare corp',
    dimensiuni_produs: 'Dimensiuni produs',
    dimensiuni_logistica: 'Dimensiuni logistica',
    garantie_ani: 'Garantie (ani)',
    utilizare_interior: 'Utilizare interior',
    utilizare_exterior: 'Utilizare exterior',
    led: 'LED',
    ceiling_base_color: 'Culoare baza tavan',
    ceiling_base_height_cm: 'Inaltime baza tavan (cm)',
    ceiling_base_length_cm: 'Lungime baza tavan (cm)',
    ceiling_base_width_cm: 'Latime baza tavan (cm)',
    floor_base_color: 'Culoare baza podea',
    floor_base_height_cm: 'Inaltime baza podea (cm)',
    floor_base_length_cm: 'Lungime baza podea (cm)',
    floor_base_width_cm: 'Latime baza podea (cm)',
    table_base_color: 'Culoare baza masa',
    table_base_height_cm: 'Inaltime baza masa (cm)',
    table_base_length_cm: 'Lungime baza masa (cm)',
    table_base_width_cm: 'Latime baza masa (cm)',
    wall_base_color: 'Culoare baza perete',
    wall_base_height_cm: 'Inaltime baza perete (cm)',
    wall_base_length_cm: 'Lungime baza perete (cm)',
    wall_base_width_cm: 'Latime baza perete (cm)',
    shade_color: 'Culoare abajur',
    shade_height_cm: 'Inaltime abajur (cm)',
    shade_length_cm: 'Lungime abajur (cm)',
    shade_width_cm: 'Latime abajur (cm)',
    power_cord_color: 'Culoare cablu alimentare',
    power_cord_length_cm: 'Lungime cablu alimentare (cm)',
    rotation: 'Rotatie',
    tilt: 'Inclinare',
    adjustment: 'Reglaj',
    app_smart: 'Control aplicatie',
    remote_control: 'Telecomanda',
    motion_sensor: 'Senzor miscare',
    sensor_range: 'Raza senzor',
    switch_location: 'Pozitie intrerupator',
    switch_panel_bt: 'Panou intrerupator BT',
    included: 'Inclus in pachet',
    warranty: 'Garantie',
    line: 'Linie',
    type: 'Tip',
    type_of_track: 'Tip sina',
    track_installation_place: 'Montaj sina',
    rgb: 'RGB',
    bluetooth_gateway: 'Gateway Bluetooth',
    related_products: 'Produse similare',
    lumen_output: 'Flux luminos',
    lumens: 'Flux luminos',
    luminous_flux: 'Flux luminos',
    cct: 'Temperatura culoare',
    color_temperature: 'Temperatura culoare',
    kelvins_k: 'Temperatura culoare',
    lumens_lm: 'Flux luminos',
    product_length_cm: 'Lungime produs (cm)',
    product_width_cm: 'Latime produs (cm)',
    product_height_cm: 'Inaltime produs (cm)',
    net_weight_kg: 'Greutate neta (kg)',
    gross_weight_kg: 'Greutate bruta (kg)',
    materia_dominujacy: 'Material principal',
    kolor_dominujacy: 'Culoare principala',
    wykonczenie_wiodace: 'Finisaj principal',
    materia_akcentowy: 'Material accent',
    kolor_akcentowy: 'Culoare accent',
    wykonczenie_akcentowe: 'Finisaj accent',
  };

  const prettify = (key: string): string => {
    if (labelByKey[key]) {
      return labelByKey[key];
    }

    return key
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const normalizeValue = (rawValue: unknown): string | null => {
    const translateSingleValue = (input: string): string => {
      const normalized = input.trim();
      if (!normalized) {
        return normalized;
      }

      const exactMap: Record<string, string> = {
        black: 'Negru',
        white: 'Alb',
        chrome: 'Crom',
        gold: 'Auriu',
        silver: 'Argintiu',
        copper: 'Cupru',
        brass: 'Alama',
        transparent: 'Transparent',
        smoke: 'Fumuriu',
        grey: 'Gri',
        gray: 'Gri',
        beige: 'Bej',
        brown: 'Maro',
        blue: 'Albastru',
        green: 'Verde',
        red: 'Rosu',
        pink: 'Roz',
        orange: 'Portocaliu',
        yellow: 'Galben',
        purple: 'Mov',
        yes: 'Da',
        no: 'Nu',
        true: 'Da',
        false: 'Nu',
        indoor: 'Interior',
        outdoor: 'Exterior',
        matte: 'Mat',
        decorative: 'Decorativ',
        ip20: 'IP20',
        ip44: 'IP44',
        ip54: 'IP54',
        ip65: 'IP65',
      };

      const lower = normalized.toLowerCase();
      if (exactMap[lower]) {
        return exactMap[lower];
      }

      return normalized
        .replace(/\bblack\b/gi, 'Negru')
        .replace(/\bwhite\b/gi, 'Alb')
        .replace(/\bchrome\b/gi, 'Crom')
        .replace(/\bgold\b/gi, 'Auriu')
        .replace(/\bsilver\b/gi, 'Argintiu')
        .replace(/\bcopper\b/gi, 'Cupru')
        .replace(/\bbrass\b/gi, 'Alama')
        .replace(/\btransparent\b/gi, 'Transparent')
        .replace(/\bsmoke\b/gi, 'Fumuriu')
        .replace(/\bgrey\b/gi, 'Gri')
        .replace(/\bgray\b/gi, 'Gri')
        .replace(/\bbeige\b/gi, 'Bej')
        .replace(/\bbrown\b/gi, 'Maro')
        .replace(/\bblue\b/gi, 'Albastru')
        .replace(/\bgreen\b/gi, 'Verde')
        .replace(/\bred\b/gi, 'Rosu')
        .replace(/\bpink\b/gi, 'Roz')
        .replace(/\borange\b/gi, 'Portocaliu')
        .replace(/\byellow\b/gi, 'Galben')
        .replace(/\bpurple\b/gi, 'Mov')
        .replace(/\byes\b/gi, 'Da')
        .replace(/\bno\b/gi, 'Nu')
        .replace(/\bindoor\b/gi, 'Interior')
        .replace(/\boutdoor\b/gi, 'Exterior')
        .replace(/\bmatte\b/gi, 'Mat')
        .replace(/\bdecorative\b/gi, 'Decorativ')
        .replace(/\b(\d+[\.,]?\d*)\s*kelvins?\s*k\b/gi, '$1 Kelvin')
        .replace(/\b(\d+[\.,]?\d*)\s*lumens?\s*lm\b/gi, '$1 Lumen')
        .replace(/\bkelvins?\s*k\b/gi, 'Kelvin')
        .replace(/\blumens?\s*lm\b/gi, 'Lumen');
    };

    if (Array.isArray(rawValue)) {
      const values = rawValue
        .map((item) => translateSingleValue(String(item ?? '').trim()))
        .filter((item) => item && !/^n\/?a$/i.test(item) && !/^https?:\/\//i.test(item));
      if (values.length === 0) {
        return null;
      }
      return Array.from(new Set(values)).join(', ');
    }

    if (rawValue && typeof rawValue === 'object') {
      const values = Object.values(rawValue as Record<string, unknown>)
        .map((item) => translateSingleValue(String(item ?? '').trim()))
        .filter((item) => item && !/^n\/?a$/i.test(item) && !/^https?:\/\//i.test(item));
      if (values.length === 0) {
        return null;
      }
      return Array.from(new Set(values)).join(', ');
    }

    const value = translateSingleValue(String(rawValue ?? '').trim());
    if (!value || /^n\/?a$/i.test(value) || /^https?:\/\//i.test(value)) {
      return null;
    }

    return value;
  };

  const rows: Array<{ label: string; value: string }> = [];
  for (const block of supplierSpecBlocks) {
    for (const [key, rawValue] of Object.entries(block)) {
      if (excludedKeys.has(key.toLowerCase())) {
        continue;
      }

      const value = normalizeValue(rawValue);
      if (!value) {
        continue;
      }

      rows.push({
        label: prettify(key.toLowerCase()),
        value,
      });
    }
  }

  const merged = new Map<string, string>();
  for (const row of rows) {
    const existing = merged.get(row.label);
    if (!existing) {
      merged.set(row.label, row.value);
      continue;
    }

    if (existing === row.value || existing.includes(row.value)) {
      continue;
    }

    merged.set(row.label, `${existing} / ${row.value}`);
  }

  return Array.from(merged.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ro'));
};

const mergeSpecRows = (
  baseRows: Array<{ label: string; value: string; icon: string }>,
  extraRows: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string; icon: string }> => {
  const normalizeSpecLabel = (value: string): string =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const byLabel = new Map<string, { label: string; value: string; icon: string }>();

  for (const row of baseRows) {
    byLabel.set(normalizeSpecLabel(row.label), row);
  }

  const aliases: Record<string, string> = {
    'cri ra': 'cri',
    'indice redare culoare ra': 'cri',
    'protection class': 'grad protectie',
    'ip rating': 'grad protectie',
    'grad de protectie': 'grad protectie',
    'grad protectie ip': 'grad protectie',
    'temperatura culoare k': 'temperatura culoare',
    'flux luminos lm': 'flux luminos',
    tensiune: 'tensiune alimentare',
  };

  for (const row of extraRows) {
    const rawLabel = normalizeSpecLabel(row.label);
    const normalizedLabel = aliases[rawLabel] || rawLabel;
    const existing = byLabel.get(normalizedLabel);

    if (existing) {
      if (!existing.value || existing.value === '—') {
        existing.value = row.value;
      }
      continue;
    }

    byLabel.set(normalizedLabel, {
      label: row.label,
      value: row.value,
      icon: '•',
    });
  }

  return Array.from(byLabel.values());
};

const orderSpecRows = (
  rows: Array<{ label: string; value: string; icon: string }>,
): Array<{ label: string; value: string; icon: string }> => {
  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const priority = [
    'cod produs',
    'ean',
    'producator',
    'tip produs',
    'serie',
    'colectie',
    'putere',
    'temperatura culoare',
    'flux luminos',
    'grad protectie',
    'cri',
    'unghi fascicul',
    'tensiune alimentare',
    'montaj',
    'material corp',
    'culoare corp',
    'dimensiuni produs',
    'greutate neta kg',
    'greutate bruta kg',
    'clasa energetica',
    'garantie ani',
    'cod eprel',
    'cod hs',
  ];

  const indexMap = new Map<string, number>();
  priority.forEach((key, index) => indexMap.set(key, index));

  const result = [...rows].sort((a, b) => {
    const aKey = normalize(a.label);
    const bKey = normalize(b.label);
    const aIndex = indexMap.has(aKey) ? (indexMap.get(aKey) as number) : Number.MAX_SAFE_INTEGER;
    const bIndex = indexMap.has(bKey) ? (indexMap.get(bKey) as number) : Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.label.localeCompare(b.label, 'ro');
  });

  return result;
};

const getDocAvailability = (productResources: Array<{ label: string; url: string; assetType?: string }>) => {
  const hasDatasheet = productResources.some(
    (item) => item.assetType === 'datasheet' || item.label.toLowerCase().includes('fisa tehnica'),
  );
  const hasInstallation = productResources.some(
    (item) => item.assetType === 'installation_guide' || item.label.toLowerCase().includes('instructiune montaj'),
  );

  return {
    hasDatasheet,
    hasInstallation,
    missingBoth: !hasDatasheet && !hasInstallation,
  };
};

export const B2BProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const storePath = (pathname: string) => resolveB2BStorePath(pathname, hostname);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedTab, setSelectedTab] = useState<'specs' | 'pricing' | 'delivery'>('specs');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<{
    label: string;
    url: string;
    sourceUrl: string;
    type: ResourcePreviewType;
  } | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    fetchProduct(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!product) {
      return;
    }

    trackViewItem({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      price: product.price,
      currency: product.currency || 'RON',
      quantity: 1,
    });
  }, [product]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product?.id]);

  const fetchProduct = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/b2b/products/${id}`, {
        credentials: 'include',
        signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch product');
      }

      const payload = await response.json();
      const data = payload?.data ?? payload;

      if (data?.success && data?.data) {
        setProduct(data.data);
      } else if (data?.id) {
        setProduct(data);
      }
    } catch (err) {
      const maybeError = err as { name?: string; code?: string; message?: string };
      if (
        maybeError?.name === 'AbortError' ||
        maybeError?.code === 'ERR_CANCELED' ||
        maybeError?.message === 'canceled'
      ) {
        return;
      }

      console.error('Failed to fetch product:', err);
      // Fallback: try from products list
      try {
        const fallbackQuery = new URLSearchParams({
          page: '1',
          limit: '24',
          search: String(id || ''),
        });
        const listResponse = await fetch(`/api/v1/b2b/products?${fallbackQuery.toString()}`, {
          credentials: 'include',
          signal,
        });

        if (!listResponse.ok) {
          throw new Error('Failed to fetch products list');
        }

        const listPayload = await listResponse.json();
        const listData = listPayload?.data ?? listPayload;

        if (listData?.success && listData?.data?.products) {
          const found = listData.data.products.find((p: Product) => p.id === Number(id));
          if (found) setProduct(found);
        } else if (Array.isArray(listData?.products)) {
          const found = listData.products.find((p: Product) => p.id === Number(id));
          if (found) setProduct(found);
        }
      } catch (fallbackErr) {
        const fallbackMaybeError = fallbackErr as { name?: string; code?: string; message?: string };
        if (
          fallbackMaybeError?.name === 'AbortError' ||
          fallbackMaybeError?.code === 'ERR_CANCELED' ||
          fallbackMaybeError?.message === 'canceled'
        ) {
          return;
        }

        // ignore
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const isPrivateObjectStorageUrl = (url: string): boolean => {
    try {
      const host = new URL(url, window.location.origin).hostname.toLowerCase();
      return host.endsWith('your-objectstorage.com');
    } catch {
      return false;
    }
  };

  const resourceIdentity = (url: string): string => {
    try {
      return decodeURIComponent(new URL(url, window.location.origin).pathname).toLowerCase();
    } catch {
      return url;
    }
  };

  const openResource = async (resource: { label: string; url: string }) => {
    let targetUrl = resource.url;

    if (isPrivateObjectStorageUrl(resource.url)) {
      try {
        const response = await fetch(`/api/v1/b2b/products/${id}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const payload = await response.json();
          const data = payload?.data ?? payload;
          const refreshedProduct = data?.success && data?.data ? data.data : data?.id ? data : null;

          if (refreshedProduct) {
            setProduct(refreshedProduct);
            const refreshedResources = parseProductResources(refreshedProduct);
            const match =
              refreshedResources.find(
                (item) =>
                  item.label === resource.label &&
                  resourceIdentity(item.url) === resourceIdentity(resource.url),
              ) || refreshedResources.find((item) => item.label === resource.label);

            if (match?.url) {
              targetUrl = match.url;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to refresh signed URL before opening document:', error);
      }
    }

    const previewType = getResourcePreviewType(targetUrl);
    if (previewType) {
      const previewUrl = `/api/v1/b2b/documents/preview?url=${encodeURIComponent(targetUrl)}`;
      setPreviewDoc({
        label: resource.label,
        url: previewUrl,
        sourceUrl: targetUrl,
        type: previewType,
      });
      return;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const adjustQuantity = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0a0a0f' }}
      >
        <Loader className="animate-spin" size={40} style={{ color: '#daa520' }} />
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: '#0a0a0f' }}
      >
        <Package size={48} style={{ color: '#333' }} />
        <p className="text-white text-lg">Produsul nu a fost găsit</p>
        <Link to={storePath('/catalog')}>
          <Button style={{ background: '#daa520', color: '#000' }}>Înapoi la Catalog</Button>
        </Link>
      </div>
    );
  }

  const specs = parseSpecs(product);
  const manufacturerLabel = specs.brand !== '—' ? specs.brand : null;
  const productGallery = getB2BProductGallery(product);
  const selectedImage: ProductGalleryImage | null = productGallery[selectedImageIndex] || productGallery[0] || null;
  const productResources = parseProductResources(product);
  const additionalSpecs = parseAdditionalSpecs(product);
  const docAvailability = getDocAvailability(productResources);
  const datasheetResource =
    productResources.find(
      (item) => item.assetType === 'datasheet' || item.label.toLowerCase().includes('fisa tehnica'),
    ) || null;
  const totalStock =
    Number(product.stock_total ?? 0) || product.stock_local + product.stock_supplier;
  const supplierLeadTimeLabel = resolveSupplierLeadTimeLabel(
    product.supplier_name,
    product.supplier_lead_time,
    product.supplier_lead_time_label,
    product.brand,
    product.manufacturer,
  );

  const tieredPricing = [
    { range: '1 — 9 buc', price: product.price, discount: '—' },
    { range: '10 — 49 buc', price: +(product.price * 0.95).toFixed(2), discount: '-5%' },
    { range: '50 — 99 buc', price: +(product.price * 0.9).toFixed(2), discount: '-10%' },
    { range: '100+ buc', price: +(product.price * 0.85).toFixed(2), discount: '-15%' },
  ];

  const getCurrentTierPrice = () => {
    if (quantity >= 100) return tieredPricing[3].price;
    if (quantity >= 50) return tieredPricing[2].price;
    if (quantity >= 10) return tieredPricing[1].price;
    return tieredPricing[0].price;
  };

  const specRowsBase = [
    { label: 'Cod produs', value: String(specs.productCode), icon: '🔢' },
    { label: 'EAN', value: String(specs.ean), icon: '🏷️' },
    { label: 'Putere', value: `${specs.watt}W`, icon: '⚡' },
    { label: 'Temperatură Culoare', value: `${specs.kelvin}K`, icon: '🌡' },
    { label: 'Flux Luminos', value: `${specs.lumen} lm`, icon: '💡' },
    { label: 'Grad Protecție', value: specs.ip, icon: '💧' },
    { label: 'CRI', value: String(specs.cri), icon: '🎨' },
    { label: 'Unghi fascicul', value: `${specs.beamAngle}°`, icon: '📐' },
    { label: 'Tensiune', value: String(specs.voltageInput), icon: '🔌' },
    { label: 'Montaj', value: String(specs.mountingType), icon: '🔧' },
    { label: 'Producator', value: String(specs.brand), icon: '🏷' },
    { label: 'Certificări', value: 'CE, RoHS', icon: '✅' },
  ];
  const specRows = orderSpecRows(mergeSpecRows(specRowsBase, additionalSpecs));

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
      {/* Breadcrumb */}
      <div className="py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs" style={{ color: '#555' }}>
            <Link to={storePath('/')} className="hover:text-white transition-colors">
              Acasă
            </Link>
            <ChevronRight size={12} />
            <Link to={storePath('/catalog')} className="hover:text-white transition-colors">
              Catalog
            </Link>
            <ChevronRight size={12} />
            <span style={{ color: '#daa520' }}>{product.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Back Link */}
        <Link
          to={storePath('/catalog')}
          className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-colors"
          style={{ color: '#888' }}
        >
          <ArrowLeft size={16} />
          Înapoi la Catalog
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* ========== LEFT: IMAGE ========== */}
          <div>
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: '#111118',
                border: '1px solid rgba(255,255,255,0.06)',
                height: '500px',
              }}
            >
              {selectedImage?.url ? (
                <ResponsiveImage
                  src={selectedImage.url}
                  alt={selectedImage.alt_text || product.name}
                  loading="eager"
                  fetchPriority="high"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  width={1200}
                  height={1200}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Zap size={80} style={{ color: '#1a1a22' }} />
                </div>
              )}
              {product.stock_local > 0 && (
                <div
                  className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide"
                  style={{ background: 'rgba(218, 165, 32, 0.9)', color: '#111' }}
                >
                  ✓ Stoc Local
                </div>
              )}
            </div>

            {productGallery.length > 1 && (
              <div className="grid grid-cols-5 gap-3 mt-4">
                {productGallery.map((image, index) => (
                  <button
                    key={`${image.url}-${index}`}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className="rounded-xl overflow-hidden"
                    style={{
                      height: '88px',
                      background: '#111118',
                      border:
                        index === selectedImageIndex
                          ? '1px solid rgba(218,165,32,0.5)'
                          : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <ResponsiveImage
                      src={image.url}
                      alt={image.alt_text || `${product.name} ${index + 1}`}
                      sizes="88px"
                      width={176}
                      height={176}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Action icons */}
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#888',
                }}
              >
                <Heart size={16} /> Salvează
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#888',
                }}
              >
                <Share2 size={16} /> Distribuie
              </button>
              <button
                type="button"
                onClick={() => {
                  if (datasheetResource) {
                    void openResource(datasheetResource);
                  }
                }}
                disabled={!datasheetResource}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: datasheetResource ? '#888' : '#555',
                  opacity: datasheetResource ? 1 : 0.5,
                  cursor: datasheetResource ? 'pointer' : 'not-allowed',
                }}
              >
                <Download size={16} /> Fișă Tehnică
              </button>
            </div>
          </div>

          {/* ========== RIGHT: DETAILS ========== */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: '#daa520' }}
            >
              {product.category || 'LED'} · SKU: {product.sku}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {product.name}
            </h1>
            {manufacturerLabel && (
              <p className="text-sm mb-4" style={{ color: '#888' }}>
                Producator: <span className="text-white font-medium">{manufacturerLabel}</span>
              </p>
            )}

            {/* Spec Badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              {specs.watt !== '—' && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(218,165,32,0.1)',
                    color: '#daa520',
                    border: '1px solid rgba(218,165,32,0.2)',
                  }}
                >
                  ⚡ {specs.watt}W
                </span>
              )}
              {specs.kelvin !== '—' && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(218,165,32,0.1)',
                    color: '#daa520',
                    border: '1px solid rgba(218,165,32,0.2)',
                  }}
                >
                  🌡 {specs.kelvin}K
                </span>
              )}
              {specs.ip !== '—' && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(218,165,32,0.1)',
                    color: '#daa520',
                    border: '1px solid rgba(218,165,32,0.2)',
                  }}
                >
                  💧 {specs.ip}
                </span>
              )}
              {specs.lumen !== '—' && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(218,165,32,0.1)',
                    color: '#daa520',
                    border: '1px solid rgba(218,165,32,0.2)',
                  }}
                >
                  💡 {specs.lumen}lm
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed mb-8" style={{ color: '#777' }}>
              {product.description ||
                'Corp de iluminat LED de înaltă calitate, proiectat pentru instalații profesionale. Eficiență energetică ridicată și durată de viață extinsă.'}
            </p>

            {/* Stock Status */}
            <div
              className="rounded-xl p-5 mb-6"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h4
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: '#888' }}
              >
                Disponibilitate
              </h4>
              <div className="space-y-2.5">
                {product.stock_local > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm" style={{ color: '#daa520' }}>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: '#daa520' }}
                      />
                      Stoc Local
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {product.stock_local} buc —{' '}
                      <span style={{ color: '#daa520' }}>Livrare 24h</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm" style={{ color: '#ef4444' }}>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: '#ef4444' }}
                      />
                      Stoc Local
                    </span>
                    <span className="text-sm" style={{ color: '#ef4444' }}>
                      Epuizat
                    </span>
                  </div>
                )}
                {getSupplierStockDetail(product) && (
                  <div className="flex items-center justify-between">
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: getSupplierStockDetail(product)!.color }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: getSupplierStockDetail(product)!.color }}
                      />
                      Stoc Furnizor
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {getSupplierStockDetail(product)!.quantityText} —{' '}
                      <span style={{ color: getSupplierStockDetail(product)!.color }}>
                        {supplierLeadTimeLabel} zile
                      </span>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#6b7280' }} />
                    Stoc Total
                  </span>
                  <span className="text-sm font-semibold text-white">{totalStock} buc</span>
                </div>
              </div>
            </div>

            {/* Price */}
            <div
              className="rounded-xl p-6 mb-6"
              style={{
                background: 'rgba(218,165,32,0.04)',
                border: '1px solid rgba(218,165,32,0.12)',
              }}
            >
              <div className="flex items-end gap-3 mb-1">
                <span className="text-4xl font-bold" style={{ color: '#daa520' }}>
                  {getCurrentTierPrice().toFixed(2)}
                </span>
                <span className="text-lg mb-1" style={{ color: '#666' }}>
                  {product.currency}
                </span>
                <span
                  className="text-xs mb-1.5 px-2 py-0.5 rounded"
                  style={{ background: 'rgba(218,165,32,0.1)', color: '#daa520' }}
                >
                  fără TVA
                </span>
              </div>
              {quantity >= 10 && (
                <p className="text-xs" style={{ color: '#daa520' }}>
                  ✓ Ai discount de volum aplicat automat!
                </p>
              )}
            </div>

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <button
                  onClick={() => adjustQuantity(-1)}
                  className="w-12 h-12 flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', color: '#888' }}
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-12 text-center text-sm font-semibold focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.02)', color: '#fff', border: 'none' }}
                />
                <button
                  onClick={() => adjustQuantity(1)}
                  className="w-12 h-12 flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', color: '#888' }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <Button
                className="flex-1 h-12 rounded-xl text-black font-semibold text-base"
                style={{
                  background: 'linear-gradient(135deg, #daa520, #ffd700)',
                  boxShadow: '0 4px 20px rgba(218,165,32,0.25)',
                }}
              >
                <ShoppingCart size={18} className="mr-2" />
                Adaugă în Coș — {(getCurrentTierPrice() * quantity).toFixed(2)} {product.currency}
              </Button>
            </div>

            {/* Request Quote */}
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              style={{ borderColor: 'rgba(218,165,32,0.2)', color: '#daa520' }}
            >
              <FileText size={16} className="mr-2" />
              Solicită Ofertă Personalizată
            </Button>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { icon: <Truck size={16} />, text: 'Livrare Rapidă' },
                { icon: <Shield size={16} />, text: 'Garanție 3 Ani' },
                { icon: <Package size={16} />, text: 'Retur 30 Zile' },
              ].map((badge) => (
                <div
                  key={badge.text}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-center"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span style={{ color: '#daa520' }}>{badge.icon}</span>
                  <span className="text-[10px] font-medium" style={{ color: '#666' }}>
                    {badge.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========== TABS: SPECS / PRICING / DELIVERY ========== */}
        <div className="mt-16">
          <div
            className="flex gap-6 mb-8"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[
              { key: 'specs' as const, label: 'Specificații Tehnice' },
              { key: 'pricing' as const, label: 'Prețuri pe Cantitate' },
              { key: 'delivery' as const, label: 'Livrare & Garanție' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className="pb-4 text-sm font-medium transition-colors relative"
                style={{
                  color: selectedTab === tab.key ? '#daa520' : '#666',
                }}
              >
                {tab.label}
                {selectedTab === tab.key && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: '#daa520' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Specs Tab */}
          {selectedTab === 'specs' && (
            <div className="space-y-4">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {specRows.map((row, idx) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-6 py-4"
                    style={{
                      borderBottom:
                        idx < specRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                  >
                    <span className="flex items-center gap-3 text-sm" style={{ color: '#888' }}>
                      <span>{row.icon}</span>
                      {row.label}
                    </span>
                    <span className="text-sm font-semibold text-white">{row.value}</span>
                  </div>
                ))}
              </div>

              {productResources.length > 0 && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="px-6 py-4 text-sm font-semibold"
                    style={{ color: '#daa520', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    Documente si resurse
                  </div>
                  {productResources.map((item, idx) => (
                    <button
                      type="button"
                      key={`${item.label}-${idx}`}
                      onClick={() => openResource(item)}
                      className="flex items-center justify-between px-6 py-3 text-sm hover:bg-surface-primary/5 transition-colors"
                      style={{
                        width: '100%',
                        borderBottom:
                          idx < productResources.length - 1
                            ? '1px solid rgba(255,255,255,0.04)'
                            : 'none',
                        color: '#ddd',
                        textAlign: 'left',
                      }}
                    >
                      <span>{item.label}</span>
                      <span className="flex items-center gap-2">
                        {getResourcePreviewType(item.url) && <Eye size={14} style={{ color: '#9ca3af' }} />}
                        <Download size={14} style={{ color: '#9ca3af' }} />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {(docAvailability.missingBoth || !docAvailability.hasDatasheet || !docAvailability.hasInstallation) && (
                <div
                  className="rounded-2xl p-4 text-sm"
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#fbbf24',
                  }}
                >
                  {docAvailability.missingBoth
                    ? 'Fișa tehnică și instrucțiunile de instalare nu sunt disponibile momentan pentru acest produs în sursa furnizorului.'
                    : !docAvailability.hasDatasheet
                      ? 'Fișa tehnică nu este disponibilă momentan pentru acest produs în sursa furnizorului.'
                      : 'Instrucțiunile de instalare nu sunt disponibile momentan pentru acest produs în sursa furnizorului.'}
                </div>
              )}

            </div>
          )}

          {/* Pricing Tab */}
          {selectedTab === 'pricing' && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="grid grid-cols-3 px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#666', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span>Cantitate</span>
                <span className="text-center">Preț / Buc</span>
                <span className="text-right">Discount</span>
              </div>
              {tieredPricing.map((tier, idx) => (
                <div
                  key={tier.range}
                  className="grid grid-cols-3 items-center px-6 py-4"
                  style={{
                    borderBottom:
                      idx < tieredPricing.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <span className="text-sm text-white font-medium">{tier.range}</span>
                  <span className="text-sm font-bold text-center" style={{ color: '#daa520' }}>
                    {tier.price.toFixed(2)} {product.currency}
                  </span>
                  <span
                    className="text-sm text-right font-semibold"
                    style={{ color: tier.discount !== '—' ? '#daa520' : '#555' }}
                  >
                    {tier.discount}
                  </span>
                </div>
              ))}
              <div
                className="px-6 py-4 text-xs"
                style={{
                  color: '#666',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(218,165,32,0.03)',
                }}
              >
                💡 Pentru cantități mai mari de 500 buc, solicită ofertă personalizată prin butonul
                de mai sus.
              </div>
            </div>
          )}

          {/* Delivery Tab */}
          {selectedTab === 'delivery' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Truck size={18} style={{ color: '#daa520' }} />
                  Livrare
                </h4>
                <div className="space-y-3 text-sm" style={{ color: '#888' }}>
                  <p>
                    • Produse din stoc local:{' '}
                    <span className="text-white font-medium">livrare în 24-48h</span>
                  </p>
                  <p>
                    • Produse de la furnizor:{' '}
                    <span className="text-white font-medium">
                      {supplierLeadTimeLabel} zile lucrătoare
                    </span>
                  </p>
                  <p>
                    • Transport gratuit pentru comenzi peste{' '}
                    <span className="text-white font-medium">2,000 RON</span>
                  </p>
                  <p>• Livrare cu tracking în timp real</p>
                  <p>• Opțiune livrare express disponibilă</p>
                </div>
              </div>
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Shield size={18} style={{ color: '#daa520' }} />
                  Garanție & Retur
                </h4>
                <div className="space-y-3 text-sm" style={{ color: '#888' }}>
                  <p>
                    • Garanție producător: <span className="text-white font-medium">3 ani</span>
                  </p>
                  <p>
                    • Retur gratuit în <span className="text-white font-medium">30 de zile</span>
                  </p>
                  <p>• Suport tehnic dedicat prin WhatsApp și email</p>
                  <p>
                    • Certificări: <span className="text-white font-medium">CE, RoHS, TUV</span>
                  </p>
                  <p>• Înlocuire rapidă pentru produse defecte</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {previewDoc && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.78)' }}
          >
            <div
              className="w-full max-w-6xl rounded-2xl overflow-hidden"
              style={{
                background: '#0f0f14',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 25px 80px rgba(0,0,0,0.45)',
              }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="text-sm font-medium text-white truncate pr-4">{previewDoc.label}</div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(218,165,32,0.15)', color: '#daa520' }}
                  >
                    Deschide separat
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#bbb' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div style={{ height: '80vh', background: '#0b0b10' }}>
                {previewDoc.type === 'pdf' ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.label}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                    <img
                      src={previewDoc.url}
                      alt={previewDoc.label}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
