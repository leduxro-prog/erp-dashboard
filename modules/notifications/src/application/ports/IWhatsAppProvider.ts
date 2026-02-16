/**
 * WhatsApp Provider Port (Interface)
 * Defines contract for WhatsApp Business API implementations
 *
 * @interface IWhatsAppProvider
 */

export interface WhatsAppSendResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
  timestamp: Date;
}

export interface WhatsAppButton {
  type: 'QUICK_REPLY' | 'CALL_TO_ACTION' | 'CALL_TO_ACTION_PHONE_NUMBER';
  text: string;
  id?: string;
  url?: string;
  phoneNumber?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  parameters?: Record<string, unknown>;
}

/**
 * Port interface for WhatsApp Business API
 * Implementations provide WhatsApp message sending integration
 */
export interface IWhatsAppProvider {
  /**
   * Send a WhatsApp template message
   *
   * @param to - Recipient phone number (international format)
   * @param templateName - Name of pre-approved WhatsApp template
   * @param templateLanguage - Language code (e.g., 'en', 'ro')
   * @param templateData - Data for template variables
   * @param options - Additional options
   * @returns WhatsApp send result with messageId and status
   * @throws {Error} If message sending fails
   */
  sendTemplateMessage(
    to: string,
    templateName: string,
    templateLanguage: string,
    templateData: Record<string, unknown>,
    options?: {
      buttons?: WhatsAppButton[];
      headerText?: string;
      footerText?: string;
    }
  ): Promise<WhatsAppSendResult>;

  /**
   * Send a free-form WhatsApp message
   * Not recommended for production - templates are preferred
   *
   * @param to - Recipient phone number
   * @param body - Message text
   * @param options - Additional options
   * @returns WhatsApp send result
   */
  sendTextMessage(
    to: string,
    body: string,
    options?: {
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'document' | 'audio';
      caption?: string;
    }
  ): Promise<WhatsAppSendResult>;

  /**
   * Get list of approved templates
   *
   * @returns Array of template names
   */
  getTemplates(): Promise<string[]>;

  /**
   * Validate phone number format
   *
   * @param phoneNumber - Phone number to validate
   * @returns True if phone number is valid
   */
  validatePhoneNumber(phoneNumber: string): boolean;

  /**
   * Test WhatsApp provider connectivity
   *
   * @returns True if provider is accessible and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider name
   *
   * @returns Name of the WhatsApp provider
   */
  getProviderName(): string;
}
