/**
 * Notification Preferences Service
 * Manages customer notification preferences and respects rate limits
 */

import { DataSource } from 'typeorm';

export interface NotificationPreferences {
  customerId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;

  quoteSentEmail: boolean;
  quoteSentSms: boolean;
  quoteSentWhatsapp: boolean;

  quoteReminderEmail: boolean;
  quoteReminderSms: boolean;
  quoteReminderWhatsapp: boolean;

  quoteAcceptedEmail: boolean;
  quoteAcceptedSms: boolean;
  quoteAcceptedWhatsapp: boolean;

  quoteRejectedEmail: boolean;
  quoteRejectedSms: boolean;
  quoteRejectedWhatsapp: boolean;

  quoteExpiredEmail: boolean;
  quoteExpiredSms: boolean;
  quoteExpiredWhatsapp: boolean;

  emailAddress?: string;
  smsPhone?: string;
  whatsappPhone?: string;

  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone: string;

  maxEmailsPerDay: number;
  maxSmsPerDay: number;
  maxWhatsappPerDay: number;

  language: string;
}

export interface NotificationChannel {
  channel: 'email' | 'sms' | 'whatsapp';
  enabled: boolean;
  contact: string;
}

export class NotificationPreferencesService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get customer notification preferences
   */
  async getPreferences(customerId: string): Promise<NotificationPreferences | null> {
    const query = `
      SELECT
        customer_id as "customerId",
        email_enabled as "emailEnabled",
        sms_enabled as "smsEnabled",
        whatsapp_enabled as "whatsappEnabled",
        quote_sent_email as "quoteSentEmail",
        quote_sent_sms as "quoteSentSms",
        quote_sent_whatsapp as "quoteSentWhatsapp",
        quote_reminder_email as "quoteReminderEmail",
        quote_reminder_sms as "quoteReminderSms",
        quote_reminder_whatsapp as "quoteReminderWhatsapp",
        quote_accepted_email as "quoteAcceptedEmail",
        quote_accepted_sms as "quoteAcceptedSms",
        quote_accepted_whatsapp as "quoteAcceptedWhatsapp",
        quote_rejected_email as "quoteRejectedEmail",
        quote_rejected_sms as "quoteRejectedSms",
        quote_rejected_whatsapp as "quoteRejectedWhatsapp",
        quote_expired_email as "quoteExpiredEmail",
        quote_expired_sms as "quoteExpiredSms",
        quote_expired_whatsapp as "quoteExpiredWhatsapp",
        email_address as "emailAddress",
        sms_phone as "smsPhone",
        whatsapp_phone as "whatsappPhone",
        quiet_hours_enabled as "quietHoursEnabled",
        quiet_hours_start as "quietHoursStart",
        quiet_hours_end as "quietHoursEnd",
        quiet_hours_timezone as "quietHoursTimezone",
        max_emails_per_day as "maxEmailsPerDay",
        max_sms_per_day as "maxSmsPerDay",
        max_whatsapp_per_day as "maxWhatsappPerDay",
        language
      FROM customer_notification_preferences
      WHERE customer_id = $1
    `;

    const [preferences] = await this.dataSource.query(query, [customerId]);
    return preferences || null;
  }

  /**
   * Update customer notification preferences
   */
  async updatePreferences(
    customerId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'customerId') continue;

      // Convert camelCase to snake_case
      const columnName = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      setClauses.push(`${columnName} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return;
    }

    values.push(customerId);

    const query = `
      INSERT INTO customer_notification_preferences (customer_id)
      VALUES ($${paramIndex})
      ON CONFLICT (customer_id)
      DO UPDATE SET
        ${setClauses.join(', ')},
        updated_at = NOW()
    `;

    await this.dataSource.query(query, values);
  }

  /**
   * Get enabled channels for a specific notification type
   */
  async getEnabledChannels(
    customerId: string,
    notificationType: 'quote_sent' | 'quote_reminder' | 'quote_accepted' | 'quote_rejected' | 'quote_expired'
  ): Promise<NotificationChannel[]> {
    const preferences = await this.getPreferences(customerId);

    if (!preferences) {
      // Default: email only
      return [{
        channel: 'email',
        enabled: true,
        contact: '', // Will be fetched from customer table
      }];
    }

    const channels: NotificationChannel[] = [];

    // Map notification type to preference fields
    const typeMap: Record<string, { email: boolean; sms: boolean; whatsapp: boolean }> = {
      quote_sent: {
        email: preferences.quoteSentEmail,
        sms: preferences.quoteSentSms,
        whatsapp: preferences.quoteSentWhatsapp,
      },
      quote_reminder: {
        email: preferences.quoteReminderEmail,
        sms: preferences.quoteReminderSms,
        whatsapp: preferences.quoteReminderWhatsapp,
      },
      quote_accepted: {
        email: preferences.quoteAcceptedEmail,
        sms: preferences.quoteAcceptedSms,
        whatsapp: preferences.quoteAcceptedWhatsapp,
      },
      quote_rejected: {
        email: preferences.quoteRejectedEmail,
        sms: preferences.quoteRejectedSms,
        whatsapp: preferences.quoteRejectedWhatsapp,
      },
      quote_expired: {
        email: preferences.quoteExpiredEmail,
        sms: preferences.quoteExpiredSms,
        whatsapp: preferences.quoteExpiredWhatsapp,
      },
    };

    const typePrefs = typeMap[notificationType];

    if (preferences.emailEnabled && typePrefs.email && preferences.emailAddress) {
      channels.push({
        channel: 'email',
        enabled: true,
        contact: preferences.emailAddress,
      });
    }

    if (preferences.smsEnabled && typePrefs.sms && preferences.smsPhone) {
      channels.push({
        channel: 'sms',
        enabled: true,
        contact: preferences.smsPhone,
      });
    }

    if (preferences.whatsappEnabled && typePrefs.whatsapp && preferences.whatsappPhone) {
      channels.push({
        channel: 'whatsapp',
        enabled: true,
        contact: preferences.whatsappPhone,
      });
    }

    return channels;
  }

  /**
   * Check if notification can be sent (respects quiet hours and rate limits)
   */
  async canSendNotification(
    customerId: string,
    channel: 'email' | 'sms' | 'whatsapp'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const preferences = await this.getPreferences(customerId);

    if (!preferences) {
      return { allowed: true };
    }

    // Check quiet hours
    if (preferences.quietHoursEnabled && preferences.quietHoursStart && preferences.quietHoursEnd) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: preferences.quietHoursTimezone,
      });

      if (currentTime >= preferences.quietHoursStart && currentTime <= preferences.quietHoursEnd) {
        return {
          allowed: false,
          reason: `Customer is in quiet hours (${preferences.quietHoursStart} - ${preferences.quietHoursEnd})`,
        };
      }
    }

    // Check rate limits
    const maxPerDay = channel === 'email'
      ? preferences.maxEmailsPerDay
      : channel === 'sms'
      ? preferences.maxSmsPerDay
      : preferences.maxWhatsappPerDay;

    if (maxPerDay > 0) {
      const todayCount = await this.getTodayNotificationCount(customerId, channel);

      if (todayCount >= maxPerDay) {
        return {
          allowed: false,
          reason: `Daily ${channel} limit reached (${maxPerDay} per day)`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Log sent notification
   */
  async logNotification(
    customerId: string,
    notificationType: string,
    channel: 'email' | 'sms' | 'whatsapp',
    success: boolean,
    quotationId?: string,
    errorMessage?: string,
    metadata?: any
  ): Promise<void> {
    const query = `
      INSERT INTO customer_notification_log
        (customer_id, notification_type, channel, success, quotation_id, error_message, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await this.dataSource.query(query, [
      customerId,
      notificationType,
      channel,
      success,
      quotationId || null,
      errorMessage || null,
      metadata ? JSON.stringify(metadata) : null,
    ]);
  }

  /**
   * Get today's notification count for a customer and channel
   */
  private async getTodayNotificationCount(
    customerId: string,
    channel: 'email' | 'sms' | 'whatsapp'
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM customer_notification_log
      WHERE customer_id = $1
        AND channel = $2
        AND sent_at >= CURRENT_DATE
        AND success = true
    `;

    const [result] = await this.dataSource.query(query, [customerId, channel]);
    return parseInt(result?.count || '0');
  }

  /**
   * Get notification statistics for a customer
   */
  async getNotificationStats(customerId: string, days: number = 30): Promise<any> {
    const query = `
      SELECT
        notification_type,
        channel,
        COUNT(*) as total,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed
      FROM customer_notification_log
      WHERE customer_id = $1
        AND sent_at >= NOW() - INTERVAL '${days} days'
      GROUP BY notification_type, channel
      ORDER BY notification_type, channel
    `;

    return await this.dataSource.query(query, [customerId]);
  }
}
