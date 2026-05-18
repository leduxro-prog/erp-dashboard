import * as crypto from 'crypto';

import {
    ICypherModule,
    IModuleContext,
    IModuleHealth,
    IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { Router } from 'express';

import { ResendEmailAdapter } from '../../../modules/notifications/src/infrastructure/adapters/ResendEmailAdapter';
import { renderTemplate } from '../../../modules/notifications/src/infrastructure/templates';

import { UserController } from './api/controllers/UserController';
import { createTwoFactorRoutes } from './api/routes/twofa.routes';
import { TwoFactorAuthService } from './application/services/TwoFactorAuthService';
import { UserService } from './application/services/UserService';
import { UserEntity, UserRole } from './domain/entities/UserEntity';

export class UsersModule implements ICypherModule {
    public readonly name = 'users';
    public readonly version = '1.0.0';
    public readonly description = 'User Management and Authentication';
    public readonly dependencies = [];
    public readonly publishedEvents = ['user.created', 'user.deleted'];
    public readonly subscribedEvents = [];

    private router: Router;
    private logger = createModuleLogger('users');
    private context!: IModuleContext;
    private userService!: UserService;
    private twoFactorAuthService!: TwoFactorAuthService;
    private userController!: UserController;
    private eventBus: any; // Using any for now to avoid import issues, but explicitly typed in method

    constructor() {
        this.router = Router();
    }

    async initialize(context: IModuleContext): Promise<void> {
        this.logger.info('Initializing UsersModule...');
        this.context = context;

        this.eventBus = context.eventBus;

        // Initialize Service and Controller
        this.userService = new UserService(context.dataSource);
        this.twoFactorAuthService = new TwoFactorAuthService(context.dataSource.getRepository(UserEntity));
        const sendPasswordResetEmail = this.createPasswordResetEmailSender();
        this.userController = new UserController(
            this.userService,
            this.twoFactorAuthService,
            sendPasswordResetEmail,
        );

        // Initialize Router
        this.router = this.userController.getRouter();
        this.router.use('/2fa', createTwoFactorRoutes(this.userService, this.twoFactorAuthService));

        this.logger.info('UsersModule initialized.');
    }

    /**
     * Creates a callback for sending password reset emails.
     * Uses the Resend email adapter with the password-reset HTML template.
     */
    private createPasswordResetEmailSender(): (
        email: string,
        resetToken: string,
        userName: string,
    ) => Promise<void> {
        return async (email: string, resetToken: string, userName: string) => {
            const resendApiKey = process.env.RESEND_API_KEY;
            if (!resendApiKey) {
                this.logger.warn('RESEND_API_KEY not set — password reset email not sent');
                return;
            }

            const frontendUrl = process.env.FRONTEND_URL || 'https://ledux.ro';
            const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
            const expirationHours = 1;
            const expirationTime = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

            const { html } = renderTemplate('password-reset', {
                customerEmail: email,
                customerName: userName,
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
                subject: 'Resetare Parolă — Ledux.ro',
                html,
            });

            if (!result.success) {
                throw new Error(result.error || 'Failed to send password reset email');
            }
        };
    }

    private async setupEventListeners(): Promise<void> {
        await this.eventBus.subscribe('b2b.registration_approved', this.handleB2BRegistrationApproved.bind(this));
    }

    private async handleB2BRegistrationApproved(data: any): Promise<void> {
        this.logger.info('Received b2b.registration_approved event', data);
        try {
            const { registration, customerId } = data;

            // Check if user already exists
            const existingUser = await this.userService.findByUsername(registration.email);
            if (existingUser) {
                this.logger.warn(`User with email ${registration.email} already exists. Skipping creation.`);
                return;
            }

            // Generate cryptographically secure random password
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
            let tempPassword = '';
            const randomBytes = crypto.randomBytes(12);
            for (let i = 0; i < 12; i++) {
                tempPassword += chars[randomBytes[i] % chars.length];
            }
            tempPassword = tempPassword.slice(0, 8) + 'A' + 'a' + '1' + '!';

            await this.userService.create({
                email: registration.email,
                password: tempPassword,
                first_name: registration.first_name || registration.firstName || registration.companyName || 'B2B',
                last_name: registration.last_name || registration.lastName || 'User',
                phone_number: registration.phoneNumber,
                role: UserRole.B2B_USER,
            });

            this.logger.info(`Created user for B2B customer ${customerId} with email ${registration.email}`);

            // TODO: Send email with credentials to the user
            // await this.emailService.sendWelcomeEmail(registration.email, tempPassword);

        } catch (error) {
            this.logger.error('Failed to create user for B2B registration', error);
        }
    }

    async start(): Promise<void> {
        await this.setupEventListeners();
        this.logger.info('UsersModule started.');
    }

    async stop(): Promise<void> {
        if (typeof this.eventBus?.unsubscribe === 'function') {
            await this.eventBus.unsubscribe('b2b.registration_approved');
        }
        this.logger.info('UsersModule stopped.');
    }

    getRouter(): Router {
        return this.router;
    }

    async getHealth(): Promise<IModuleHealth> {
        try {
            const result = await this.context.dataSource.query('SELECT COUNT(*)::int AS total FROM users');
            const usersCount = Number(result?.[0]?.total ?? 0);

            return {
                status: 'healthy',
                details: {
                    database: {
                        status: 'up',
                        message: `${usersCount} users total`
                    }
                },
                lastChecked: new Date(),
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    database: {
                        status: 'down',
                        message: error instanceof Error ? error.message : String(error),
                    }
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
                received: 0
            }
        };
    }
}
