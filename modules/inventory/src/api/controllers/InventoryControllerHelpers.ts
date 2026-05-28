export interface InventoryCursor {
  name: string;
  id: number;
}

export class InventoryControllerHelpers {
  private readonly allowedImageExtensions = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
  ]);

  private readonly allowedRemoteImageMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

  isValidProductImageUrl(imageUrl: unknown): boolean {
    if (typeof imageUrl !== 'string') {
      return false;
    }

    const trimmed = imageUrl.trim();
    if (!trimmed || trimmed.length > 2000) {
      return false;
    }

    if (trimmed.startsWith('/uploads/products/')) {
      const lowerPath = trimmed.toLowerCase();
      return Array.from(this.allowedImageExtensions).some((ext) => lowerPath.includes(ext));
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }

      const lowerPathname = parsed.pathname.toLowerCase();
      return Array.from(this.allowedImageExtensions).some((ext) => lowerPathname.endsWith(ext));
    } catch (_error) {
      return false;
    }
  }

  async hasValidImageMimeType(imageUrl: string): Promise<boolean> {
    if (imageUrl.startsWith('/uploads/products/')) {
      return true;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const checkResponse = async (response: globalThis.Response): Promise<boolean> => {
        const contentType = (response.headers.get('content-type') || '')
          .split(';')[0]
          .trim()
          .toLowerCase();
        return response.ok && this.allowedRemoteImageMimeTypes.has(contentType);
      };

      const headResponse = await fetch(imageUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });

      if (await checkResponse(headResponse)) {
        return true;
      }

      const getResponse = await fetch(imageUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: controller.signal,
      });

      return checkResponse(getResponse);
    } catch (_error) {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  getCatalogCategorySqlExpression(): string {
    const categoryText =
      "LOWER(COALESCE(c.name, '') || ' ' || COALESCE(p.name, '') || ' ' || COALESCE(p.sku, ''))";

    return `
      CASE
        WHEN ${categoryText} LIKE '%cctv%'
          OR ${categoryText} LIKE '%camera%'
          OR ${categoryText} LIKE '%kamery%'
          OR ${categoryText} LIKE '%nvr%'
          OR ${categoryText} LIKE '%xvr%'
          OR ${categoryText} LIKE '%dvr%'
          OR ${categoryText} LIKE '%rejestr%'
          THEN 'Securitate CCTV'
        WHEN ${categoryText} LIKE '%pv%'
          OR ${categoryText} LIKE '%fotovolta%'
          OR ${categoryText} LIKE '%solar%'
          OR ${categoryText} LIKE '%falown%'
          OR ${categoryText} LIKE '%inverter%'
          OR ${categoryText} LIKE '%inverto%'
          OR ${categoryText} LIKE '%microinverter%'
          THEN 'Fotovoltaice'
        WHEN ${categoryText} LIKE '%profil%'
          OR ${categoryText} LIKE '%profile%'
          OR ${categoryText} LIKE '%alulicht%'
          OR ${categoryText} LIKE '%helios profile%'
          THEN 'Profile LED'
        WHEN ${categoryText} LIKE '%benzi%'
          OR ${categoryText} LIKE '%banda%'
          OR ${categoryText} LIKE '%strip%'
          OR ${categoryText} LIKE '%backlight%'
          OR ${categoryText} LIKE '%led neon%'
          OR ${categoryText} LIKE '%cob%'
          OR ${categoryText} LIKE '%rgb%'
          THEN 'Benzi LED'
        WHEN ${categoryText} LIKE '%sursa%'
          OR ${categoryText} LIKE '%alimentator%'
          OR ${categoryText} LIKE '%driver%'
          OR ${categoryText} LIKE '%power supply%'
          OR ${categoryText} LIKE '%gpv%'
          OR ${categoryText} LIKE '%gpc%'
          OR ${categoryText} LIKE '%din%'
          OR ${categoryText} LIKE '%cliq%'
          OR ${categoryText} LIKE '%adin%'
          OR ${categoryText} LIKE '%adws%'
          OR ${categoryText} LIKE '%adls%'
          OR ${categoryText} LIKE '%mchq%'
          OR ${categoryText} LIKE '%ftpc%'
          OR ${categoryText} LIKE '%pos %'
          OR ${categoryText} LIKE '%adapter%'
          OR ${categoryText} LIKE '%desktop%'
          OR ${categoryText} LIKE '%delta%'
          OR ${categoryText} LIKE '%hqs%'
          OR ${categoryText} LIKE '%lyte%'
          OR ${categoryText} LIKE '%mnc%'
          OR ${categoryText} LIKE '%force-gt%'
          OR ${categoryText} LIKE '%gv6%'
          OR ${categoryText} LIKE '%dl2%'
          OR ${categoryText} LIKE '%ds2%'
          OR ${categoryText} LIKE '%af series%'
          OR ${categoryText} LIKE '%ay series%'
          OR ${categoryText} LIKE '%aca lighting%'
          THEN 'Surse si Drivere'
        WHEN ${categoryText} LIKE '%bec%'
          OR ${categoryText} LIKE '%bulb%'
          OR ${categoryText} LIKE '%tub%'
          OR ${categoryText} LIKE '%t8%'
          OR ${categoryText} LIKE '%t5%'
          OR ${categoryText} LIKE '%e27%'
          OR ${categoryText} LIKE '%e14%'
          OR ${categoryText} LIKE '%gu10%'
          THEN 'Becuri si Tuburi LED'
        WHEN ${categoryText} LIKE '%automat%'
          OR ${categoryText} LIKE '%smart%'
          OR ${categoryText} LIKE '%zigbee%'
          OR ${categoryText} LIKE '%sensor%'
          OR ${categoryText} LIKE '%senzor%'
          OR ${categoryText} LIKE '%controler%'
          OR ${categoryText} LIKE '%controller%'
          OR ${categoryText} LIKE '%mi-light%'
          OR ${categoryText} LIKE '%gateway%'
          OR ${categoryText} LIKE '%bramki%'
          THEN 'Automatizari si Smart'
        WHEN ${categoryText} LIKE '%cablu%'
          OR ${categoryText} LIKE '%kable%'
          OR ${categoryText} LIKE '%priza%'
          OR ${categoryText} LIKE '%intrerup%'
          OR ${categoryText} LIKE '%sigurant%'
          OR ${categoryText} LIKE '%tablou%'
          OR ${categoryText} LIKE '%elektr%'
          OR ${categoryText} LIKE '%electr%'
          THEN 'Materiale Electrice'
        WHEN ${categoryText} LIKE '%proiector%'
          OR ${categoryText} LIKE '%flood%'
          OR ${categoryText} LIKE '%exterior%'
          OR ${categoryText} LIKE '%outdoor%'
          OR ${categoryText} LIKE '%garden%'
          OR ${categoryText} LIKE '%stradal%'
          OR ${categoryText} LIKE '%ip65%'
          OR ${categoryText} LIKE '%ip66%'
          OR ${categoryText} LIKE '%ip67%'
          THEN 'Iluminat Exterior'
        WHEN ${categoryText} LIKE '%industrial%'
          OR ${categoryText} LIKE '%highbay%'
          OR ${categoryText} LIKE '%depozit%'
          OR ${categoryText} LIKE '%hala%'
          OR ${categoryText} LIKE '%emergenc%'
          THEN 'Iluminat Industrial'
        WHEN ${categoryText} LIKE '%spot%'
          OR ${categoryText} LIKE '%downlight%'
          OR ${categoryText} LIKE '%panel%'
          OR ${categoryText} LIKE '%panou%'
          OR ${categoryText} LIKE '%lustra%'
          OR ${categoryText} LIKE '%pendul%'
          OR ${categoryText} LIKE '%aplica%'
          OR ${categoryText} LIKE '%plafon%'
          OR ${categoryText} LIKE '%track%'
          OR ${categoryText} LIKE '%azzardo%'
          THEN 'Iluminat Interior'
        ELSE 'Diverse'
      END
    `;
  }

  parseMultiValue(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .flatMap((entry) => String(entry || '').split(','))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    return [];
  }

  normalizeLedColorFilterValue(value: string): string {
    const normalized = value.toLowerCase().trim().replace(/\u000B/g, '');
    const withoutK = normalized.endsWith('k') ? normalized.slice(0, -1) : normalized;

    if (/^\d{3}$/.test(withoutK)) {
      return `${withoutK}0`;
    }

    return withoutK;
  }

  normalizeCatalogCategory(rawCategory: string | null, productName: string, sku: string): string {
    const text = `${rawCategory || ''} ${productName || ''} ${sku || ''}`.toLowerCase();

    if (
      text.includes('cctv') ||
      text.includes('camera') ||
      text.includes('kamery') ||
      text.includes('nvr') ||
      text.includes('xvr')
    ) {
      return 'Securitate CCTV';
    }

    if (
      text.includes('pv') ||
      text.includes('fotovolta') ||
      text.includes('solar') ||
      text.includes('inverter') ||
      text.includes('falown')
    ) {
      return 'Fotovoltaice';
    }

    if (text.includes('profil') || text.includes('profile') || text.includes('alulicht')) {
      return 'Profile LED';
    }

    if (
      text.includes('benzi') ||
      text.includes('banda') ||
      text.includes('strip') ||
      text.includes('neon') ||
      text.includes('cob')
    ) {
      return 'Benzi LED';
    }

    if (
      text.includes('sursa') ||
      text.includes('alimentator') ||
      text.includes('driver') ||
      text.includes('power supply') ||
      text.includes('adin') ||
      text.includes('adws') ||
      text.includes('gpv') ||
      text.includes('din') ||
      text.includes('cliq')
    ) {
      return 'Surse si Drivere';
    }

    if (
      text.includes('bec') ||
      text.includes('bulb') ||
      text.includes('tub') ||
      text.includes('t8') ||
      text.includes('t5') ||
      text.includes('e27') ||
      text.includes('e14') ||
      text.includes('gu10')
    ) {
      return 'Becuri si Tuburi LED';
    }

    if (
      text.includes('spot') ||
      text.includes('downlight') ||
      text.includes('panel') ||
      text.includes('panou') ||
      text.includes('lustra') ||
      text.includes('pendul') ||
      text.includes('aplica') ||
      text.includes('plafon') ||
      text.includes('track') ||
      text.includes('azzardo')
    ) {
      return 'Iluminat Interior';
    }

    if (
      text.includes('proiector') ||
      text.includes('flood') ||
      text.includes('exterior') ||
      text.includes('outdoor') ||
      text.includes('stradal') ||
      text.includes('ip65') ||
      text.includes('ip66') ||
      text.includes('ip67')
    ) {
      return 'Iluminat Exterior';
    }

    if (text.includes('industrial') || text.includes('highbay') || text.includes('depozit')) {
      return 'Iluminat Industrial';
    }

    if (
      text.includes('cablu') ||
      text.includes('kable') ||
      text.includes('priza') ||
      text.includes('intrerup') ||
      text.includes('electr')
    ) {
      return 'Materiale Electrice';
    }

    if (
      text.includes('automat') ||
      text.includes('smart') ||
      text.includes('zigbee') ||
      text.includes('sensor') ||
      text.includes('senzor')
    ) {
      return 'Automatizari si Smart';
    }

    if (text.includes('akcesoria') || text.includes('accesor')) {
      return 'Accesorii Iluminat';
    }

    return 'Diverse';
  }

  normalizeCatalogSubcategory(rawCategory: string | null, rootCategory: string): string {
    const raw = String(rawCategory || '').trim();
    if (!raw) {
      return '';
    }

    const lower = raw.toLowerCase();
    const rootLower = String(rootCategory || '').trim().toLowerCase();

    if (!lower || (rootLower && lower === rootLower)) {
      return '';
    }

    if (
      lower === 'general' ||
      lower === 'diverse' ||
      lower === 'misc' ||
      lower === 'other' ||
      lower === 'inne' ||
      lower === 'pozostale' ||
      lower === 'pozostale produkty' ||
      lower === 'product categories' ||
      lower === 'oswietlenie' ||
      lower === 'inne zrodla swiatla' ||
      lower === 'akcesoria i osprzet' ||
      lower === 'sterowanie roletami / zaslonami'
    ) {
      return 'Diverse';
    }

    const hasNonAscii = /[^\x00-\x7F]/.test(raw);
    if (hasNonAscii) {
      return 'Diverse';
    }

    const mappedSubcategories: Record<string, string> = {
      'kable ac': 'Cabluri AC',
      'kable dc': 'Cabluri DC',
      akcesoria: 'Accesorii',
      falowniki: 'Invertoare',
      'inwertery domowe': 'Invertoare rezidentiale',
      czujniki: 'Senzori',
      bramki: 'Gateway',
      'panele dotykowe i stacje meteo': 'Panouri tactile si statii meteo',
      adws: 'ADWS',
      adin: 'ADIN',
      gpv: 'GPV',
      gpvp: 'GPVP',
      cob: 'COB',
      hqs: 'HQS',
      backlight: 'Backlight',
      'mi-light': 'MI-Light',
      alulicht: 'ALULICHT',
      'mw lighting': 'MW LIGHTING',
      'helios profile led': 'Helios profile LED',
      'pos-c / -c2': 'POS-C / -C2',
      'pos adapter/desktop': 'POS Adapter/Desktop',
      'sunny adapter': 'Sunny Adapter',
      'led neon': 'LED Neon',
      azzardo: 'Azzardo',
      'panouri led': 'Panouri LED',
      'downlight-uri': 'Downlight-uri',
      'spoturi led': 'Spoturi LED',
      'becuri led': 'Becuri LED',
      'tuburi led': 'Tuburi LED',
      'proiectoare led': 'Proiectoare LED',
      'hale & depozite': 'Hale & Depozite',
    };

    const mappedSubcategory = mappedSubcategories[lower];
    if (mappedSubcategory) {
      return mappedSubcategory;
    }

    if (lower.startsWith('kamery ')) {
      return raw.replace(/^kamery/i, 'Camere');
    }

    if (lower.startsWith('rejestratory ')) {
      return raw.replace(/^rejestratory/i, 'Inregistratoare');
    }

    if (lower.startsWith('inwertery ')) {
      return raw.replace(/^inwertery/i, 'Invertoare');
    }

    return 'Diverse';
  }

  encodeInventoryCursor(cursor: InventoryCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  decodeInventoryCursor(rawCursor: string): InventoryCursor | null {
    try {
      const decoded = Buffer.from(rawCursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as Partial<InventoryCursor>;

      if (typeof parsed.name !== 'string') {
        return null;
      }

      const id = Number(parsed.id);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }

      return {
        name: parsed.name,
        id,
      };
    } catch (_error) {
      return null;
    }
  }

  normalizeCursorName(value: unknown): string {
    return String(value ?? '').trim();
  }
}
