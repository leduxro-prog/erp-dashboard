/**
 * Connection Port Interface
 *
 * Defines the contract for managing WhatsApp Business API connection lifecycle.
 * Used by connection-related use cases (Connect, Disconnect, Reconnect, GetStatus).
 *
 * @module whatsapp/domain/ports
 */

/**
 * Connection status result.
 */
export interface ConnectionStatus {
  connected: boolean;
  phoneNumber?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'needs_authentication';
  lastConnectedAt?: Date;
}

/**
 * QR code generation result.
 */
export interface QRCodeResult {
  qrCode?: string;
  expiresIn?: number;
}

/**
 * Connection Port Interface.
 *
 * Port interface for WhatsApp connection management.
 * Implementations handle QR code generation, connection status, and disconnection.
 *
 * @interface IConnectionPort
 */
export interface IConnectionPort {
  /**
   * Get current connection status.
   *
   * @returns Promise resolving to connection status
   */
  getStatus(): Promise<ConnectionStatus>;

  /**
   * Generate QR code for WhatsApp pairing.
   *
   * @param force - Force new QR code even if already connected
   * @returns Promise resolving to QR code and expiry
   */
  generateQRCode(force?: boolean): Promise<QRCodeResult>;

  /**
   * Disconnect from WhatsApp Business API.
   *
   * @returns Promise resolving when disconnected
   */
  disconnect(): Promise<void>;
}
