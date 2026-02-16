import fs from 'fs/promises';
import path from 'path';

import { Logger } from '@shared/utils/logger';

export interface AppSettings {
  general: {
    companyName: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    currency: string;
    vatRate: number;
  };
  integrations: {
    smartbill: {
      username: string;
      token: string;
      cif: string;
    };
    woocommerce: {
      url: string;
      consumerKey: string;
      consumerSecret: string;
    };
  };
      b2b: {
          catalogVisibility: 'public' | 'login_only' | 'hidden';
          approvalMode: 'manual' | 'auto';
          showPrices: boolean;    showStock: boolean;
    allowRegistration: boolean;
    autoApprove: boolean;
    minOrderValue: string;
    defaultCreditLimit: string;
  };
  security: {
    jwt: {
      accessTokenExpiry: string;
      refreshTokenExpiry: string;
      algorithm: 'HS256' | 'RS256';
      rotateSecrets: boolean;
    };
    password: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      preventReuse: number;
      expiryDays: number;
    };
    accountLockout: {
      enabled: boolean;
      maxAttempts: number;
      lockoutDuration: number;
      resetOnSuccess: boolean;
    };
    twoFactor: {
      enabled: boolean;
      enforceForAdmins: boolean;
      enforceForAllUsers: boolean;
      allowedMethods: ('totp' | 'sms' | 'email')[];
    };
    session: {
      maxConcurrentSessions: number;
      absoluteTimeout: number;
      idleTimeout: number;
      deviceTracking: boolean;
    };
    ipWhitelist: {
      enabled: boolean;
      allowedIps: string[];
      enforceForAdmins: boolean;
    };
    auditLogging: {
      enabled: boolean;
      logLoginAttempts: boolean;
      logPasswordChanges: boolean;
      logPermissionChanges: boolean;
      logDataAccess: boolean;
      retentionDays: number;
    };
  };
  notifications: {
    email: {
      enabled: boolean;
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        username: string;
        password: string;
        from: string;
      };
      templates: {
        orderConfirmation: boolean;
        invoiceReady: boolean;
        lowStockAlert: boolean;
        passwordReset: boolean;
      };
    };
    sms: {
      enabled: boolean;
      provider: 'twilio' | 'vonage' | 'custom';
      apiKey: string;
      apiSecret: string;
      fromNumber: string;
    };
    inApp: {
      enabled: boolean;
      showBadge: boolean;
      playSound: boolean;
    };
    webhooks: {
      enabled: boolean;
      endpoints: Array<{
        url: string;
        events: string[];
        secret: string;
      }>;
    };
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
  };
  system: {
    app: {
      version: string;
      environment: 'development' | 'staging' | 'production';
      debugMode: boolean;
      maintenanceMode: boolean;
    };
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error';
      enableConsole: boolean;
      enableFile: boolean;
      filePath: string;
      maxFileSize: number;
      maxFiles: number;
    };
    performance: {
      caching: {
        enabled: boolean;
        ttl: number;
        maxItems: number;
      };
      rateLimit: {
        enabled: boolean;
        windowMs: number;
        maxRequests: number;
      };
    };
    database: {
      host: string;
      database: string;
      poolSize: number;
      connectionTimeout: number;
    };
    fileStorage: {
      provider: 'local' | 's3' | 'azure';
      maxUploadSize: number;
      allowedExtensions: string[];
      path: string;
    };
    monitoring: {
      enabled: boolean;
      prometheusPort: number;
      grafanaUrl: string;
      alertEmail: string;
    };
  };
}

export class SettingsService {
  private readonly configPath = path.join(process.cwd(), 'config', 'settings.json');
  private settings: AppSettings | null = null;

  constructor(private readonly logger: Logger) {}

  async getSettings(): Promise<AppSettings> {
    if (!this.settings) {
      await this.loadSettings();
    }
    return this.settings!;
  }

  async updateSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    this.settings = this.deepMerge(current, newSettings) as AppSettings;
    await this.saveSettings();
    return this.settings;
  }

  /**
   * Deep merge two objects, preserving nested properties.
   * Prevents shallow merge from erasing sibling keys when updating a single nested field.
   */
  private deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  private async loadSettings(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.settings = JSON.parse(data);
    } catch (error) {
      this.logger.warn('Settings file not found, using defaults', { error });
      this.settings = this.getDefaultSettings();
      await this.saveSettings();
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      this.logger.error('Failed to save settings', { error });
      throw new Error('Could not save settings');
    }
  }

  private getDefaultSettings(): AppSettings {
    return {
      general: {
        companyName: 'Nexus Enterprise Ltd',
        taxId: '',
        address: '',
        phone: '',
        email: '',
        currency: 'RON',
        vatRate: 0.21,
      },
      integrations: {
        smartbill: { username: '', token: '', cif: '' },
        woocommerce: { url: '', consumerKey: '', consumerSecret: '' },
      },
                  b2b: {
                      catalogVisibility: 'login_only',
                      approvalMode: 'manual',
                      showPrices: true,        showStock: true,
        allowRegistration: false,
        autoApprove: false,
        minOrderValue: '0',
        defaultCreditLimit: '0',
      },
      security: {
        jwt: {
          accessTokenExpiry: '1h',
          refreshTokenExpiry: '7d',
          algorithm: 'HS256',
          rotateSecrets: false,
        },
        password: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          preventReuse: 5,
          expiryDays: 90,
        },
        accountLockout: {
          enabled: true,
          maxAttempts: 5,
          lockoutDuration: 15,
          resetOnSuccess: true,
        },
        twoFactor: {
          enabled: false,
          enforceForAdmins: false,
          enforceForAllUsers: false,
          allowedMethods: ['totp'],
        },
        session: {
          maxConcurrentSessions: 3,
          absoluteTimeout: 480,
          idleTimeout: 60,
          deviceTracking: true,
        },
        ipWhitelist: {
          enabled: false,
          allowedIps: [],
          enforceForAdmins: false,
        },
        auditLogging: {
          enabled: true,
          logLoginAttempts: true,
          logPasswordChanges: true,
          logPermissionChanges: true,
          logDataAccess: false,
          retentionDays: 90,
        },
      },
      notifications: {
        email: {
          enabled: false,
          smtp: {
            host: '',
            port: 587,
            secure: false,
            username: '',
            password: '',
            from: '',
          },
          templates: {
            orderConfirmation: true,
            invoiceReady: true,
            lowStockAlert: true,
            passwordReset: true,
          },
        },
        sms: {
          enabled: false,
          provider: 'twilio',
          apiKey: '',
          apiSecret: '',
          fromNumber: '',
        },
        inApp: {
          enabled: true,
          showBadge: true,
          playSound: true,
        },
        webhooks: {
          enabled: false,
          endpoints: [],
        },
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'Europe/Bucharest',
        },
      },
      system: {
        app: {
          version: '0.1.0',
          environment: 'production',
          debugMode: false,
          maintenanceMode: false,
        },
        logging: {
          level: 'info',
          enableConsole: true,
          enableFile: true,
          filePath: '/app/logs/app.log',
          maxFileSize: 10485760,
          maxFiles: 10,
        },
        performance: {
          caching: {
            enabled: true,
            ttl: 3600,
            maxItems: 1000,
          },
          rateLimit: {
            enabled: true,
            windowMs: 900000,
            maxRequests: 100,
          },
        },
        database: {
          host: process.env.DB_HOST || 'db',
          database: process.env.DB_NAME || 'cypher_erp',
          poolSize: 25,
          connectionTimeout: 5000,
        },
        fileStorage: {
          provider: 'local',
          maxUploadSize: 10485760,
          allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'csv'],
          path: '/app/uploads',
        },
        monitoring: {
          enabled: true,
          prometheusPort: 9090,
          grafanaUrl: 'http://65.108.255.104:3002',
          alertEmail: '',
        },
      },
    };
  }
}
