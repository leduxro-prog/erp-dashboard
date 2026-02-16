/**
 * Connect WhatsApp Use-Case
 *
 * Initiates WhatsApp Business API connection by generating QR code.
 *
 * @module whatsapp/application/use-cases
 */

import { IConnectionPort } from '../../domain/ports/IConnectionPort';
import { NotFoundError } from '@shared/errors';

/**
 * Connect WhatsApp request DTO.
 */
export interface ConnectWhatsAppRequest {
  /** Force reconnection even if already connected */
  force?: boolean;
}

/**
 * Connect WhatsApp response DTO.
 */
export interface ConnectWhatsAppResponse {
  qrCode: string;
  expiresIn: number;
  status: 'pending_scan';
}

/**
 * Connect WhatsApp Use-Case.
 *
 * Application service for connecting to WhatsApp Business API.
 *
 * @class ConnectWhatsApp
 */
export class ConnectWhatsApp {
  constructor(private readonly connectionPort: IConnectionPort) {}

  /**
   * Execute use-case.
   *
   * @param request - Connect WhatsApp request
   * @returns Promise resolving to connection result with QR code
   */
  async execute(request: ConnectWhatsAppRequest = {}): Promise<ConnectWhatsAppResponse> {
    const qrResult = await this.connectionPort.generateQRCode(request.force);

    if (!qrResult.qrCode) {
      throw new NotFoundError('QR Code', 'Failed to generate QR code');
    }

    return {
      qrCode: qrResult.qrCode,
      expiresIn: qrResult.expiresIn || 300, // Default 5 minutes
      status: 'pending_scan',
    };
  }
}
