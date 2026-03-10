import { ScrapedProduct } from '../../domain/ports/IScraper';

export interface InnproIofGatewayFeeds {
  full?: string;
  light?: string;
  fullChange?: string;
}

export class InnproIofParser {
  parseGateway(rawGateway: string): InnproIofGatewayFeeds {
    const full = this.extractGatewayUrl(rawGateway, ['full']);
    const light = this.extractGatewayUrl(rawGateway, ['light']);
    const fullChange = this.extractGatewayUrl(rawGateway, ['full_change', 'fullchange']);

    return { full, light, fullChange };
  }

  parseProducts(rawFeed: string): ScrapedProduct[] {
    const xmlProducts = this.parseXmlProducts(rawFeed);
    if (xmlProducts.length > 0) {
      return this.uniqueBySku(xmlProducts);
    }

    const delimitedProducts = this.parseDelimitedProducts(rawFeed);
    return this.uniqueBySku(delimitedProducts);
  }

  private extractGatewayUrl(rawGateway: string, tokens: string[]): string | undefined {
    const normalizedTokens = tokens.map((token) => token.toLowerCase());

    for (const token of normalizedTokens) {
      const directTag = this.extractTagValue(rawGateway, [token]);
      if (directTag && /^https?:\/\//i.test(directTag)) {
        return directTag;
      }

      const attrRegex = new RegExp(`<[^>]*${token}[^>]*url=["']([^"']+)["'][^>]*>`, 'i');
      const attrMatch = rawGateway.match(attrRegex);
      if (attrMatch?.[1] && /^https?:\/\//i.test(attrMatch[1])) {
        return attrMatch[1].trim();
      }
    }

    const urls = rawGateway.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    for (const token of normalizedTokens) {
      const matched = urls.find((url) => url.toLowerCase().includes(token));
      if (matched) {
        return matched.trim();
      }
    }

    return undefined;
  }

  private parseXmlProducts(rawFeed: string): ScrapedProduct[] {
    const blocks = rawFeed.match(/<(product|item|offer|entry)\b[\s\S]*?<\/(product|item|offer|entry)>/gi) || [];
    const products: ScrapedProduct[] = [];

    for (const block of blocks) {
      const supplierSku =
        this.extractTagValue(block, ['supplier_sku', 'suppliersku', 'sku', 'code', 'index']) ||
        this.extractAttribute(block, ['supplier_sku', 'suppliersku', 'sku', 'code']);
      if (!supplierSku) {
        continue;
      }

      const name = this.extractTagValue(block, ['name', 'title', 'product_name']) || supplierSku;
      const price =
        this.parseNumber(this.extractTagValue(block, ['price', 'net_price', 'purchase_price', 'cost'])) || 0;
      const stockQuantity = this.parseInteger(
        this.extractTagValue(block, ['stock', 'stock_qty', 'quantity', 'qty', 'available']),
      );
      const currency = this.extractTagValue(block, ['currency']) || 'RON';
      const category = this.extractTagValue(block, ['category', 'category_name']);
      const images = this.extractImageCollectionFromXml(block);
      const imageUrl = images[0] || this.extractTagValue(block, ['image', 'image_url', 'photo', 'picture']);
      const description = this.extractTagValue(block, ['description', 'short_description', 'desc']);
      const brand = this.extractTagValue(block, ['brand']);
      const manufacturer = this.extractTagValue(block, ['manufacturer', 'producer']);
      const ean = this.extractTagValue(block, ['ean', 'ean_code']);
      const specifications = this.extractSpecifications(block, description);

      const product: ScrapedProduct = {
        supplierSku,
        name,
        price,
        currency,
        category,
        imageUrl,
        images: images.length > 0 ? images : undefined,
        brand,
        manufacturer,
        ean,
        specifications,
      };
      if (typeof stockQuantity === 'number') {
        product.stockQuantity = stockQuantity;
      }
      products.push(product);
    }

    return products;
  }

  private parseDelimitedProducts(rawFeed: string): ScrapedProduct[] {
    const lines = rawFeed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    if (lines.length < 2) {
      return [];
    }

    const separator = this.detectSeparator(lines[0]);
    const headers = lines[0].split(separator).map((header) => this.normalizeHeader(header));

    const indexSku = this.findHeaderIndex(headers, ['suppliersku', 'suppliersku', 'sku', 'code', 'index']);
    const indexName = this.findHeaderIndex(headers, ['name', 'title', 'productname']);
    const indexPrice = this.findHeaderIndex(headers, ['price', 'netprice', 'purchaseprice']);
    const indexStock = this.findHeaderIndex(headers, ['stock', 'stockqty', 'quantity', 'qty', 'available']);
    const indexCurrency = this.findHeaderIndex(headers, ['currency']);
    const indexCategory = this.findHeaderIndex(headers, ['category', 'categoryname']);
    const indexImage = this.findHeaderIndex(headers, ['image', 'imageurl', 'photo']);

    if (indexSku < 0) {
      return [];
    }

    const products: ScrapedProduct[] = [];
    for (const line of lines.slice(1)) {
      const columns = line.split(separator).map((part) => part.trim());
      const supplierSku = columns[indexSku];
      if (!supplierSku) {
        continue;
      }

      const name = indexName >= 0 ? columns[indexName] || supplierSku : supplierSku;
      const price = indexPrice >= 0 ? this.parseNumber(columns[indexPrice]) || 0 : 0;
      const stockQuantity = indexStock >= 0 ? this.parseInteger(columns[indexStock]) : undefined;
      const currency = indexCurrency >= 0 ? columns[indexCurrency] || 'RON' : 'RON';
      const category = indexCategory >= 0 ? columns[indexCategory] || undefined : undefined;
      const imageCollection = this.extractImageCollectionFromColumns(headers, columns);
      const imageUrl = imageCollection[0] || (indexImage >= 0 ? columns[indexImage] || undefined : undefined);
      const indexDescription = this.findHeaderIndex(headers, ['description', 'desc', 'shortdescription']);
      const indexBrand = this.findHeaderIndex(headers, ['brand']);
      const indexManufacturer = this.findHeaderIndex(headers, ['manufacturer', 'producer']);
      const indexEan = this.findHeaderIndex(headers, ['ean', 'eancode']);
      const description = indexDescription >= 0 ? columns[indexDescription] || undefined : undefined;
      const brand = indexBrand >= 0 ? columns[indexBrand] || undefined : undefined;
      const manufacturer = indexManufacturer >= 0 ? columns[indexManufacturer] || undefined : undefined;
      const ean = indexEan >= 0 ? columns[indexEan] || undefined : undefined;
      const specifications = this.extractSpecificationsFromColumns(headers, columns, description);

      const product: ScrapedProduct = {
        supplierSku,
        name,
        price,
        currency,
        category,
        imageUrl,
        images: imageCollection.length > 0 ? imageCollection : undefined,
        brand,
        manufacturer,
        ean,
        specifications,
      };
      if (typeof stockQuantity === 'number') {
        product.stockQuantity = stockQuantity;
      }
      products.push(product);
    }

    return products;
  }

  private uniqueBySku(products: ScrapedProduct[]): ScrapedProduct[] {
    const map = new Map<string, ScrapedProduct>();
    for (const product of products) {
      const key = String(product.supplierSku || '').trim().toUpperCase();
      if (!key) {
        continue;
      }
      map.set(key, {
        ...product,
        supplierSku: String(product.supplierSku || '').trim(),
      });
    }
    return Array.from(map.values());
  }

  private extractTagValue(raw: string, tags: string[]): string | undefined {
    for (const tag of tags) {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
      const match = raw.match(regex);
      if (!match?.[1]) {
        continue;
      }

      const value = this.decodeXmlEntities(match[1]).trim();
      if (value.length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private extractAttribute(raw: string, attributes: string[]): string | undefined {
    for (const attribute of attributes) {
      const regex = new RegExp(`${attribute}=["']([^"']+)["']`, 'i');
      const match = raw.match(regex);
      if (!match?.[1]) {
        continue;
      }

      const value = this.decodeXmlEntities(match[1]).trim();
      if (value.length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private parseNumber(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.replace(',', '.');
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return undefined;
    }

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseInteger(value: string | undefined): number | undefined {
    const parsed = this.parseNumber(value);
    return typeof parsed === 'number' && Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }

  private detectSeparator(headerLine: string): string {
    const candidates = [';', '\t', '|', ','];
    let best = ';';
    let bestCount = 0;

    for (const candidate of candidates) {
      const count = headerLine.split(candidate).length;
      if (count > bestCount) {
        best = candidate;
        bestCount = count;
      }
    }

    return best;
  }

  private normalizeHeader(rawHeader: string): string {
    return rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private findHeaderIndex(headers: string[], aliases: string[]): number {
    for (const alias of aliases) {
      const index = headers.indexOf(alias);
      if (index >= 0) {
        return index;
      }
    }

    return -1;
  }

  private decodeXmlEntities(value: string): string {
    return value
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'");
  }

  private extractSpecifications(rawBlock: string, description?: string): ScrapedProduct['specifications'] {
    const wattage = this.parseNumber(this.extractTagValue(rawBlock, ['wattage', 'power']));
    const lumens = this.parseInteger(this.extractTagValue(rawBlock, ['lumens', 'luminous_flux']));
    const colorTemperature = this.parseInteger(
      this.extractTagValue(rawBlock, ['color_temperature', 'colour_temperature', 'kelvin']),
    );
    const cri = this.parseInteger(this.extractTagValue(rawBlock, ['cri', 'ra']));
    const beamAngle = this.parseInteger(this.extractTagValue(rawBlock, ['beam_angle', 'beamangle']));
    const ipRating = this.extractTagValue(rawBlock, ['ip', 'ip_rating']);
    const voltageInput = this.extractTagValue(rawBlock, ['voltage', 'voltage_input']);

    const customSpecs: Record<string, unknown> = {};
    if (description && description.trim().length > 0) {
      customSpecs.description = description.trim();
    }

    const hasCoreSpec =
      typeof wattage === 'number'
      || typeof lumens === 'number'
      || typeof colorTemperature === 'number'
      || typeof cri === 'number'
      || typeof beamAngle === 'number'
      || Boolean(ipRating)
      || Boolean(voltageInput);

    if (!hasCoreSpec && Object.keys(customSpecs).length === 0) {
      return undefined;
    }

    return {
      wattage: typeof wattage === 'number' ? wattage : undefined,
      lumens: typeof lumens === 'number' ? lumens : undefined,
      colorTemperature: typeof colorTemperature === 'number' ? colorTemperature : undefined,
      cri: typeof cri === 'number' ? cri : undefined,
      beamAngle: typeof beamAngle === 'number' ? beamAngle : undefined,
      ipRating,
      voltageInput,
      customSpecs,
    };
  }

  private extractSpecificationsFromColumns(
    headers: string[],
    columns: string[],
    description?: string,
  ): ScrapedProduct['specifications'] {
    const getByAliases = (aliases: string[]): string | undefined => {
      for (const alias of aliases) {
        const index = headers.indexOf(alias);
        if (index >= 0) {
          const value = columns[index];
          if (value && value.trim().length > 0) {
            return value.trim();
          }
        }
      }
      return undefined;
    };

    const wattage = this.parseNumber(getByAliases(['wattage', 'power']));
    const lumens = this.parseInteger(getByAliases(['lumens', 'luminousflux']));
    const colorTemperature = this.parseInteger(getByAliases(['colortemperature', 'colourtemperature', 'kelvin']));
    const cri = this.parseInteger(getByAliases(['cri', 'ra']));
    const beamAngle = this.parseInteger(getByAliases(['beamangle']));
    const ipRating = getByAliases(['ip', 'iprating']);
    const voltageInput = getByAliases(['voltage', 'voltageinput']);

    const customSpecs: Record<string, unknown> = {};
    if (description && description.trim().length > 0) {
      customSpecs.description = description.trim();
    }

    const hasCoreSpec =
      typeof wattage === 'number'
      || typeof lumens === 'number'
      || typeof colorTemperature === 'number'
      || typeof cri === 'number'
      || typeof beamAngle === 'number'
      || Boolean(ipRating)
      || Boolean(voltageInput);

    if (!hasCoreSpec && Object.keys(customSpecs).length === 0) {
      return undefined;
    }

    return {
      wattage: typeof wattage === 'number' ? wattage : undefined,
      lumens: typeof lumens === 'number' ? lumens : undefined,
      colorTemperature: typeof colorTemperature === 'number' ? colorTemperature : undefined,
      cri: typeof cri === 'number' ? cri : undefined,
      beamAngle: typeof beamAngle === 'number' ? beamAngle : undefined,
      ipRating,
      voltageInput,
      customSpecs,
    };
  }

  private extractImageCollectionFromXml(rawBlock: string): string[] {
    const urls = new Set<string>();

    const imageTagRegex = /<(image(?:_[0-9]+)?|photo(?:_[0-9]+)?|picture(?:_[0-9]+)?|img(?:_[0-9]+)?)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null = imageTagRegex.exec(rawBlock);
    while (match) {
      const value = this.decodeXmlEntities(String(match[2] || '')).trim();
      if (/^https?:\/\//i.test(value)) {
        urls.add(value);
      }
      match = imageTagRegex.exec(rawBlock);
    }

    return Array.from(urls.values());
  }

  private extractImageCollectionFromColumns(headers: string[], columns: string[]): string[] {
    const urls = new Set<string>();

    headers.forEach((header, index) => {
      if (!/^image\d*$/.test(header) && !/^photo\d*$/.test(header) && !/^picture\d*$/.test(header)) {
        return;
      }

      const value = String(columns[index] || '').trim();
      if (/^https?:\/\//i.test(value)) {
        urls.add(value);
      }
    });

    return Array.from(urls.values());
  }
}
