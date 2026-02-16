/**
 * Get Connection Status Use-Case
 *
 * Retrieves the current WhatsApp Business API connection status.
 *
 * @module whatsapp/application/use-cases
 */

import { IConnectionPort } from '../../domain/ports/IConnectionPort';

/**
 * Connection status response DTO.
 */
export interface ConnectionStatusResponse {
  connected: boolean;
  phoneNumber?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'needs_authentication';
  lastConnectedAt?: string;
}

/**
 * Get Connection Status Use-Case.
 *
 * Application service for retrieving WhatsApp connection status.
 *
 * @class GetConnectionStatus
 */
export class GetConnectionStatus {
  constructor(private readonly connectionPort: IConnectionPort) {}

  /**
   * Execute use-case.
   *
   * @returns Promise resolving to connection status
   */
  async execute(): Promise<ConnectionStatusResponse> {
    const status = await this.connectionPort.getStatus();

    return {
      connected: status.connected,
      phoneNumber: status.phoneNumber,
      status: status.status,
      lastConnectedAt: status.lastConnectedAt?.toISOString(),
    };
  }
}
