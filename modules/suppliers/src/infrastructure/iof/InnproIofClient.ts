import axios, { AxiosInstance } from 'axios';

import { SupplierCredentials } from '../../domain';

export class InnproIofClient {
  constructor(private readonly http: AxiosInstance = axios.create({ timeout: 30000 })) {}

  async readGateway(credentials: SupplierCredentials): Promise<string> {
    const gatewayUrl = this.resolveGatewayUrl(credentials);
    return this.readFeed(gatewayUrl, credentials);
  }

  async readFeed(url: string, credentials: SupplierCredentials): Promise<string> {
    const response = await this.http.get<string>(url, {
      responseType: 'text',
      auth:
        credentials.username && credentials.password
          ? {
              username: credentials.username,
              password: credentials.password,
            }
          : undefined,
      headers: {
        Accept: 'application/xml,text/xml,text/plain,*/*',
      },
    });

    return typeof response.data === 'string' ? response.data : String(response.data || '');
  }

  private resolveGatewayUrl(credentials: SupplierCredentials): string {
    const candidates = [
      credentials.customHeader?.apiEndpoint,
      credentials.apiKey,
    ];

    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (/^https?:\/\//i.test(normalized)) {
        return normalized;
      }
    }

    throw new Error('Innpro IOF gateway URL is missing in supplier credentials');
  }
}
