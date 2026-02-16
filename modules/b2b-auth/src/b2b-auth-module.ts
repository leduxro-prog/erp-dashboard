import { Router } from 'express';
import { DataSource } from 'typeorm';
import {
  ICypherModule,
  IModuleContext,
  IModuleHealth,
  IModuleMetrics,
} from '../../../shared/module-system/module.interface';
import { createModuleLogger } from '../../../shared/utils/logger';
import { B2BAuthController } from './api/controllers/B2BAuthController';
import { LoginB2BCustomer } from './application/use-cases/LoginB2BCustomer';
import { RefreshB2BToken } from './application/use-cases/RefreshB2BToken';
import { ForgotB2BPassword } from './application/use-cases/ForgotB2BPassword';
import { ResetB2BPassword } from './application/use-cases/ResetB2BPassword';
import { renderTemplate } from '../../../modules/notifications/src/infrastructure/templates';
import { ResendEmailAdapter } from '../../../modules/notifications/src/infrastructure/adapters/ResendEmailAdapter';

export class B2BAuthModule implements ICypherModule {
  readonly name = 'b2b-auth';
  readonly version = '1.0.0';
  readonly description = 'B2B Customer Authentication and Authorization';
  readonly dependencies: string[] = ['b2b-portal']; // Depends on B2B portal for customer data
  readonly publishedEvents = [
    'b2b-auth.login_successful',
    'b2b-auth.login_failed',
    'b2b-auth.token_refreshed',
    'b2b-auth.logout',
  ];
  readonly subscribedEvents: string[] = [];

  private router!: Router;
  private context!: IModuleContext;
  private dataSource!: DataSource;
  private logger = createModuleLogger('b2b-auth');

  async initialize(context: IModuleContext): Promise<void> {
    this.context = context;
    this.dataSource = context.dataSource;

    // Verify JWT_SECRET_B2B is configured
    if (!process.env.JWT_SECRET_B2B) {
      throw new Error('JWT_SECRET_B2B environment variable is required for B2B authentication');
    }

    // Note: TypeORM will auto-discover entities from modules directory
    // No manual registration needed if entities are in standard location

    // Create event publisher wrapper
    const publishEvent = async (event: string, data: unknown): Promise<void> => {
      await context.eventBus.publish(event, data);
    };

    // Initialize use cases
    const loginB2BCustomer = new LoginB2BCustomer(this.dataSource, publishEvent);
    const refreshB2BToken = new RefreshB2BToken(this.dataSource, publishEvent);
    const forgotB2BPassword = new ForgotB2BPassword(this.dataSource);
    const resetB2BPassword = new ResetB2BPassword(this.dataSource);
    const sendPasswordResetEmail = this.createPasswordResetEmailSender();

    // Initialize controller
    const controller = new B2BAuthController(
      loginB2BCustomer,
      refreshB2BToken,
      forgotB2BPassword,
      resetB2BPassword,
      sendPasswordResetEmail,
    );

    // Get router from controller
    this.router = controller.getRouter();

    console.log(`[${this.name}] Module initialized successfully`);
  }

  async start(): Promise<void> {
    // Subscribe to events if needed in the future
    // For example: handle customer deletion to remove auth credentials

    console.log(`[${this.name}] Module started successfully`);
  }

  async stop(): Promise<void> {
    console.log(`[${this.name}] Module stopped`);
  }

  getRouter(): Router {
    return this.router;
  }

  async getHealth(): Promise<IModuleHealth> {
    try {
      // Check database connection
      await this.dataSource.query('SELECT 1');

      // Check if JWT_SECRET_B2B is configured
      const hasJwtSecret = !!process.env.JWT_SECRET_B2B;

      return {
        status: hasJwtSecret ? 'healthy' : 'degraded',
        details: {
          database: {
            status: 'up',
            message: 'Connected',
          },
          jwt_configured: {
            status: hasJwtSecret ? 'up' : 'down',
            message: hasJwtSecret ? 'JWT_SECRET_B2B configured' : 'JWT_SECRET_B2B not configured',
          },
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          database: {
            status: 'down',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        lastChecked: new Date(),
      };
    }
  }

  getMetrics(): IModuleMetrics {
    return {
      requestCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      activeWorkers: 0,
      cacheHitRate: 0,
      eventCount: {
        published: 0,
        received: 0,
      },
    };
  }

  private createPasswordResetEmailSender(): (
    email: string,
    resetToken: string,
    customerName: string,
  ) => Promise<void> {
    return async (email: string, resetToken: string, customerName: string) => {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        this.logger.warn('RESEND_API_KEY not set — B2B password reset email not sent');
        return;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'https://ledux.ro';
      const resetLink = `${frontendUrl}/b2b-store/reset-password?token=${resetToken}`;
      const expirationHours = 1;
      const expirationTime = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

      const { html } = renderTemplate('password-reset', {
        customerEmail: email,
        customerName,
        resetLink,
        resetToken,
        expirationHours,
        expirationTime: expirationTime.toLocaleString('ro-RO', {
          timeZone: 'Europe/Bucharest',
        }),
        supportEmail: 'support@ledux.ro',
        supportPhone: '+40 XXX XXX XXX',
        currentYear: new Date().getFullYear(),
        unsubscribeLink: `${frontendUrl}/unsubscribe`,
        preferencesLink: `${frontendUrl}/email-preferences`,
      });

      const emailAdapter = new ResendEmailAdapter(resendApiKey);
      const result = await emailAdapter.sendEmail({
        to: email,
        subject: 'Resetare Parolă B2B — Ledux.ro',
        html,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send B2B password reset email');
      }
    };
  }
}

export default new B2BAuthModule();
