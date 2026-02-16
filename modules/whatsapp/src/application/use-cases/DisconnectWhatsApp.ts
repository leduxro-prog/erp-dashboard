/**
 * Disconnect WhatsApp Use-Case
 *
 * Disconnects the WhatsApp Business API connection.
 *
 * @module whatsapp/application/use-cases
 */

import { IConnectionPort } from '../../domain/ports/IConnectionPort';

/**
 * Disconnect WhatsApp response DTO.
 */
export interface DisconnectWhatsAppResponse {
  disconnectedAt: string;
}

/**
 * Disconnect WhatsApp Use-Case.
 *
 * Application service for disconnecting from WhatsApp Business API.
 *
 * @class DisconnectWhatsApp
 */
export class DisconnectWhatsApp {
  constructor(private readonly connectionPort: IConnectionPort) {}

  /**
   * Execute use-case.
   *
   * @returns Promise resolving to disconnect result
   */
  async execute(): Promise<DisconnectWhatsAppResponse> {
    await this.connectionPort.disconnect();

    return {
      disconnectedAt: new Date().toISOString(),
    };
  }
}
