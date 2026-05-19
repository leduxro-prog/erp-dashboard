import { beforeEach, describe, expect, it } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';

import SettingsModule from '../../src/settings-module';
import type { AppSettings } from '../../src/application/services/SettingsService';

function buildFixture(): AppSettings {
  return {
    general: {
      companyName: 'Ledux SRL',
      taxId: 'RO12345678',
      address: 'Str. Luminilor 10',
      phone: '+40 700 000 000',
      email: 'office@ledux.ro',
      currency: 'RON',
      vatRate: 19,
    },
    integrations: {
      smartbill: {
        username: 'smartbill-user',
        token: 'smartbill-secret-token',
        cif: 'RO12345678',
      },
      woocommerce: {
        url: 'https://shop.ledux.ro',
        consumerKey: 'wc-consumer-key',
        consumerSecret: 'wc-consumer-secret',
      },
    },
    b2b: {
      catalogVisibility: 'login_only',
      approvalMode: 'manual',
      showPrices: true,
      showStock: false,
      allowRegistration: true,
      autoApprove: false,
      minOrderValue: '500',
      defaultCreditLimit: '5000',
    },
    security: {
      jwt: {
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d',
        algorithm: 'HS256',
        rotateSecrets: true,
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
        lockoutDuration: 30,
        resetOnSuccess: true,
      },
      twoFactor: {
        enabled: true,
        enforceForAdmins: true,
        enforceForAllUsers: false,
        allowedMethods: ['totp', 'email'],
      },
      session: {
        maxConcurrentSessions: 2,
        absoluteTimeout: 480,
        idleTimeout: 60,
        deviceTracking: true,
      },
      ipWhitelist: {
        enabled: false,
        allowedIps: ['127.0.0.1'],
        enforceForAdmins: false,
      },
      auditLogging: {
        enabled: true,
        logLoginAttempts: true,
        logPasswordChanges: true,
        logPermissionChanges: true,
        logDataAccess: true,
        retentionDays: 365,
      },
    },
    notifications: {
      email: {
        enabled: true,
        smtp: {
          host: 'smtp.example.com',
          port: 465,
          secure: true,
          username: 'smtp-user',
          password: 'smtp-secret-password',
          from: 'noreply@ledux.ro',
        },
        templates: {
          orderConfirmation: true,
          invoiceReady: true,
          lowStockAlert: true,
          passwordReset: true,
        },
      },
      sms: {
        enabled: true,
        provider: 'twilio',
        apiKey: 'sms-api-key',
        apiSecret: 'sms-api-secret',
        fromNumber: '+40700000000',
      },
      inApp: {
        enabled: true,
        showBadge: true,
        playSound: false,
      },
      webhooks: {
        enabled: true,
        endpoints: [
          {
            url: 'https://hooks.example.com/settings',
            events: ['order.created'],
            secret: 'webhook-shared-secret',
          },
        ],
      },
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '07:00',
        timezone: 'Europe/Bucharest',
      },
    },
    system: {
      app: {
        version: '1.0.0',
        environment: 'production',
        debugMode: false,
        maintenanceMode: false,
      },
      logging: {
        level: 'info',
        enableConsole: true,
        enableFile: true,
        filePath: '/var/log/cypher/app.log',
        maxFileSize: 1024,
        maxFiles: 5,
      },
      performance: {
        caching: {
          enabled: true,
          ttl: 300,
          maxItems: 1000,
        },
        rateLimit: {
          enabled: true,
          windowMs: 60000,
          maxRequests: 100,
        },
      },
      database: {
        host: 'db.internal',
        database: 'cypher',
        poolSize: 10,
        connectionTimeout: 5000,
      },
      fileStorage: {
        provider: 'local',
        maxUploadSize: 10485760,
        allowedExtensions: ['jpg', 'png'],
        path: '/app/uploads',
      },
      monitoring: {
        enabled: true,
        prometheusPort: 9090,
        grafanaUrl: 'https://grafana.example.com',
        alertEmail: 'alerts@ledux.ro',
      },
    },
    brandStrategy: {
      selectedDirection: 'hybrid_commerce',
      brandName: 'LEDUX',
      website: 'https://ledux.ro',
      promise: 'Solutii LED disponibile rapid pentru proiecte rezidentiale si comerciale.',
      positioning: 'Magazin B2B/B2C pentru iluminat LED cu stoc si consultanta.',
      tone: ['clar', 'comercial', 'de incredere'],
      seo: {
        titleSuffix: 'Ledux.ro - solutii LED in stoc',
        metaDescriptionCta: 'Comanda online sau cere suport pentru alegerea produselor LED potrivite.',
      },
    },
  };
}

async function buildApp(settings: AppSettings): Promise<Express> {
  const module = new SettingsModule();

  await module.initialize({
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      debug: () => undefined,
    },
    dataSource: {} as any,
    eventBus: {} as any,
    cacheManager: {} as any,
    config: {},
    apiClientFactory: {} as any,
    featureFlags: {} as any,
  } as any);

  (module as any).settingsService.settings = JSON.parse(JSON.stringify(settings));

  const app = express();
  app.use(express.json());
  app.use('/api/v1/settings', module.getRouter());

  return app;
}

describe('Settings access policy', () => {
  let app: Express;
  let fixture: AppSettings;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    fixture = buildFixture();
    app = await buildApp(fixture);
  });

  it('returns only the allowed public settings fields', async () => {
    const response = await request(app).get('/api/v1/settings');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      general: fixture.general,
      b2b: fixture.b2b,
      brandStrategy: fixture.brandStrategy,
    });
    expect(Object.keys(response.body).sort()).toEqual(['b2b', 'brandStrategy', 'general']);
  });

  it('does not leak secret-bearing private settings fields in the public payload', async () => {
    const response = await request(app).get('/api/v1/settings');
    const serializedPayload = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect(response.body.integrations).toBeUndefined();
    expect(response.body.security).toBeUndefined();
    expect(response.body.notifications).toBeUndefined();
    expect(response.body.system).toBeUndefined();
    expect(serializedPayload).not.toContain(fixture.integrations.smartbill.token);
    expect(serializedPayload).not.toContain(fixture.integrations.woocommerce.consumerSecret);
    expect(serializedPayload).not.toContain(fixture.notifications.email.smtp.password);
    expect(serializedPayload).not.toContain(fixture.notifications.sms.apiSecret);
    expect(serializedPayload).not.toContain(fixture.notifications.webhooks.endpoints[0].secret);
    expect(serializedPayload).not.toContain(fixture.system.database.host);
  });

  it('rejects unauthenticated access to private settings', async () => {
    const response = await request(app).get('/api/v1/settings/private');

    expect(response.status).toBe(401);
  });

  it('rejects unauthenticated settings updates', async () => {
    const response = await request(app)
      .put('/api/v1/settings')
      .send({ general: { companyName: 'Changed Name' } });

    expect(response.status).toBe(401);
  });
});
