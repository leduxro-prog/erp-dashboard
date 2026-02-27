import axios from 'axios';

import { createModuleLogger } from '@shared/utils/logger';

import { SupplierCredentials } from '../../domain';

const logger = createModuleLogger('business-central-api');

const DEFAULT_STOCK_URL =
  "https://api.businesscentral.dynamics.com/v2.0/80c8a355-44c9-4e4c-9994-c790c908b459/production/ODataV4/Company('Maytoni%20GmbH')/InventoryRetail";
const DEFAULT_SCOPE = 'https://api.businesscentral.dynamics.com/.default';

type BusinessCentralTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type ODataResponse = {
  value?: Record<string, unknown>[];
  '@odata.nextLink'?: string;
};

type ResolvedConfig = {
  stockUrl: string;
  tokenUrl: string;
  scope: string;
  maxPages: number;
  timeoutMs: number;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
  cacheKey: string;
};

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function maybeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export class BusinessCentralApiClient {
  private cachedToken: CachedToken | null = null;

  async fetchInventoryRows(credentials: SupplierCredentials): Promise<Record<string, unknown>[]> {
    const clientId = maybeString(credentials?.username);
    const clientSecret = maybeString(credentials?.password);

    if (!clientId || !clientSecret) {
      throw new Error('Business Central credentials missing: username=clientId, password=clientSecret');
    }

    const config = this.resolveConfig(credentials);
    const accessToken = await this.getAccessToken(config, clientId, clientSecret);
    const rows = await this.fetchAllPages(config, accessToken);

    logger.info('Business Central inventory fetch completed', {
      rows: rows.length,
      stockUrl: config.stockUrl,
    });

    return rows;
  }

  private resolveConfig(credentials: SupplierCredentials): ResolvedConfig {
    const apiEndpoint = maybeString(credentials?.customHeader?.apiEndpoint);
    const metadataTokenUrl = maybeString(credentials?.customHeader?.tokenUrl);
    const metadataScope = maybeString(credentials?.customHeader?.scope);

    const stockUrl =
      apiEndpoint || maybeString(process.env.BUSINESS_CENTRAL_STOCK_URL) || DEFAULT_STOCK_URL;
    const tokenUrl =
      metadataTokenUrl ||
      maybeString(process.env.BUSINESS_CENTRAL_TOKEN_URL) ||
      this.deriveTokenUrlFromStockUrl(stockUrl) ||
      'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const scope = credentials?.apiKey || metadataScope || process.env.BUSINESS_CENTRAL_SCOPE || DEFAULT_SCOPE;

    return {
      stockUrl,
      tokenUrl,
      scope,
      maxPages: envInt('BUSINESS_CENTRAL_MAX_PAGES', 25),
      timeoutMs: envInt('BUSINESS_CENTRAL_TIMEOUT_MS', 30000),
    };
  }

  private deriveTokenUrlFromStockUrl(stockUrl: string): string | null {
    try {
      const match = stockUrl.match(/\/v2\.0\/([^/]+)\//i);
      if (!match || !match[1]) {
        return null;
      }

      return `https://login.microsoftonline.com/${match[1]}/oauth2/v2.0/token`;
    } catch {
      return null;
    }
  }

  private async getAccessToken(
    config: ResolvedConfig,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const cacheKey = `${config.tokenUrl}::${clientId}::${config.scope}`;
    if (
      this.cachedToken &&
      this.cachedToken.cacheKey === cacheKey &&
      Date.now() + 60000 < this.cachedToken.expiresAtMs
    ) {
      return this.cachedToken.accessToken;
    }

    const payload = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: config.scope,
    });

    const response = await axios.post<BusinessCentralTokenResponse>(
      config.tokenUrl,
      payload.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: config.timeoutMs,
      },
    );

    const accessToken = response.data?.access_token;
    if (!accessToken) {
      throw new Error('Business Central token endpoint did not return access_token');
    }

    const expiresIn = Number(response.data?.expires_in || 3600);
    this.cachedToken = {
      accessToken,
      expiresAtMs: Date.now() + Math.max(1, expiresIn - 60) * 1000,
      cacheKey,
    };

    return accessToken;
  }

  private async fetchAllPages(
    config: ResolvedConfig,
    accessToken: string,
  ): Promise<Record<string, unknown>[]> {
    let page = 0;
    let nextUrl: string | undefined = config.stockUrl;
    const rows: Record<string, unknown>[] = [];

    while (nextUrl && page < config.maxPages) {
      page += 1;

      const response: { data: ODataResponse } = await axios.get<ODataResponse>(nextUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        timeout: config.timeoutMs,
      });

      const pageRows = Array.isArray(response.data?.value) ? response.data.value : [];
      rows.push(...pageRows);

      logger.info('Business Central inventory page fetched', {
        page,
        pageRows: pageRows.length,
        totalRows: rows.length,
      });

      nextUrl = maybeString(response.data?.['@odata.nextLink'] || null) || undefined;
    }

    if (nextUrl) {
      logger.warn('Business Central fetch stopped at max pages', {
        maxPages: config.maxPages,
        rows: rows.length,
      });
    }

    return rows;
  }
}
