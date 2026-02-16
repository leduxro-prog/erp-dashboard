/**
 * Message Formatter Domain Service
 *
 * Formats order updates, delivery notifications, and supplier order confirmations
 * as WhatsApp messages. Generates templates with Romanian text.
 *
 * @module whatsapp/domain/services
 */

import { Order } from '../ports/IOrderPort';

/**
 * Formatted message result.
 */
export interface FormattedMessage {
  text: string;
  templateName?: string;
  templateParams?: string[];
}

/**
 * Message Formatter Service.
 *
 * Domain service for creating properly formatted messages.
 * Handles localization and template parameter extraction.
 *
 * @class MessageFormatter
 */
export class MessageFormatter {
  /**
   * Format an order confirmation message.
   *
   * @param order - The confirmed order
   * @returns Formatted message ready to send
   */
  formatOrderConfirmation(order: Order): FormattedMessage {
    const itemsText = order.items
      .map((item) => `• ${item.productName} (${item.quantity}x)`)
      .join('\n');

    return {
      templateName: 'ORDER_CONFIRMED_RO',
      templateParams: [
        order.number,
        itemsText,
        `${order.totalAmount.toFixed(2)} ${order.currency}`,
      ],
      text: `Comanda dumneavoastră #${order.number} a fost confirmată.\n\nProduse:\n${itemsText}\n\nTotal: ${order.totalAmount.toFixed(2)} ${order.currency}`,
    };
  }

  /**
   * Format an order shipped notification.
   *
   * @param order - The shipped order
   * @returns Formatted message ready to send
   */
  formatOrderShipped(order: Order): FormattedMessage {
    const deliveryInfo = order.deliveryDate
      ? `Data estimată de livrare: ${this.formatDate(order.deliveryDate)}`
      : 'Data de livrare va fi comunicată în cel mai scurt timp';

    return {
      templateName: 'ORDER_SHIPPED_RO',
      templateParams: [order.number, deliveryInfo],
      text: `Comanda #${order.number} a fost expediată!\n\n${deliveryInfo}\n\nAdresă de livrare:\n${order.shippingAddress}`,
    };
  }

  /**
   * Format an order delivered notification.
   *
   * @param order - The delivered order
   * @returns Formatted message ready to send
   */
  formatOrderDelivered(order: Order): FormattedMessage {
    return {
      templateName: 'ORDER_DELIVERED_RO',
      templateParams: [order.number],
      text: `Comanda #${order.number} a fost livrată cu succes! 📦\n\nMulțumim pentru achiziție!`,
    };
  }

  /**
   * Format a supplier order confirmation message.
   *
   * @param supplierName - Name of the supplier
   * @param orderNumber - Supplier order number
   * @param totalItems - Total number of items
   * @returns Formatted message ready to send
   */
  formatSupplierOrderConfirmation(
    supplierName: string,
    orderNumber: string,
    totalItems: number
  ): FormattedMessage {
    return {
      text: `Comandă furnizor:\n\nFurnizor: ${supplierName}\nNr. comandă: ${orderNumber}\nTotal articole: ${totalItems}\n\nStarea comenzii va fi actualizată în timp real.`,
    };
  }

  /**
   * Format a generic notification message.
   *
   * @param title - Notification title
   * @param message - Notification message
   * @returns Formatted message ready to send
   */
  formatNotification(title: string, message: string): FormattedMessage {
    return {
      text: `${title}\n\n${message}`,
    };
  }

  /**
   * Format a date in Romanian locale.
   * @internal
   *
   * @param date - Date to format
   * @returns Formatted date string in Romanian
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
