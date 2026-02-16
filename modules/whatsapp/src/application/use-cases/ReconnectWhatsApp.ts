/**
 * Reconnect WhatsApp Use-Case
 *
 * Forces reconnection to WhatsApp Business API by generating new QR code.
 *
 * @module whatsapp/application/use-cases
 */

import { IConnectionPort } from '../../domain/ports/IConnectionPort';

/**
 * Reconnect WhatsApp request DTO.
 */
export interface ReconnectWhatsAppRequest {}

/**
 * Reconnect WhatsApp response DTO.
 */
export interface ReconnectWhatsAppResponse {
  qrCode: string;
  expiresIn: number;
  status: 'pending_scan';
}

/**
 * Reconnect WhatsApp Use-Case.
 *
 * Application service for forcing reconnection to WhatsApp Business API.
 *
 * @class ReconnectWhatsApp
 */
export class ReconnectWhatsApp {
  constructor(private readonly connectionPort: IConnectionPort) {}

  /**
   * Execute use-case.
   *
   * @returns Promise resolving to reconnection result with QR code
   */
  async execute(_request: ReconnectWhatsAppRequest): Promise<ReconnectWhatsAppResponse> {
    // Disconnect first
    await this.connectionPort.disconnect();

    // Generate new QR code
    const qrResult = await this.connectionPort.generateQRCode(true);

    if (!qrResult.qrCode) {
      throw new Error('Failed to generate QR code for reconnection');
    }

    return {
      qrCode: qrResult.qrCode,
      expiresIn: qrResult.expiresIn || 300, // Default 5 minutes
      status: 'pending_scan',
    };
  }
}
