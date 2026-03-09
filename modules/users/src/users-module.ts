import { Router } from 'express';
import {
    ICypherModule,
    IModuleContext,
    IModuleHealth,
    IModuleMetrics,
} from '@shared/module-system/module.interface';
import { createModuleLogger } from '@shared/utils/logger';
import { UserService } from './application/services/UserService';
import { UserController } from './api/controllers/UserController';
import { UserEntity } from './domain/entities/UserEntity';

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
        this.userController = new UserController(this.userService);

        // Initialize Router
        this.router = this.userController.getRouter();

        this.logger.info('UsersModule initialized.');
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

            // Generate random password
            const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

            await this.userService.create({
                username: registration.email, // Use email as username for B2B
                email: registration.email,
                password: tempPassword,
                role: 'b2b_client' as any, // Using cast to avoid import cycle or enum issues
                isActive: true,
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
