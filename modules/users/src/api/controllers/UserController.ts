import { Request, Response, Router } from 'express';
import { UserService } from '../../application/services/UserService';
import { TwoFactorAuthService } from '../../application/services/TwoFactorAuthService';
import { createModuleLogger } from '@shared/utils/logger';
import { jwtService } from '@shared/services/JwtService';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import * as jwt from 'jsonwebtoken';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validateBody,
} from '../validators/auth.validators';
import { authRateLimiter } from '../../../../../src/middleware/rate-limiter';

export class UserController {
  private router: Router;
  private logger = createModuleLogger('UserController');

  constructor(
    private userService: UserService,
    private twoFactorAuthService: TwoFactorAuthService,
    private sendPasswordResetEmail?: (
      email: string,
      resetToken: string,
      userName: string,
    ) => Promise<void>,
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Apply strict rate limiting (20 requests/hour) to login to prevent brute force
    this.router.post('/login', authRateLimiter, validateBody(loginSchema), this.login.bind(this));

    // Password reset routes (rate-limited like login to prevent abuse)
    this.router.post(
      '/forgot-password',
      authRateLimiter,
      validateBody(forgotPasswordSchema),
      this.forgotPassword.bind(this),
    );
    this.router.post(
      '/reset-password',
      validateBody(resetPasswordSchema),
      this.resetPassword.bind(this),
    );

    // 2FA routes are registered via twofa.routes.ts with proper auth middleware

    this.router.get('/', authenticate, requireRole(['admin']), this.getAllUsers.bind(this));
    this.router.post(
      '/',
      authenticate,
      requireRole(['admin']),
      validateBody(registerSchema),
      this.createUser.bind(this),
    );
    this.router.delete('/:id', authenticate, requireRole(['admin']), this.deleteUser.bind(this));
  }

  public getRouter(): Router {
    return this.router;
  }

  private async getAllUsers(req: Request, res: Response) {
    try {
      const users = await this.userService.findAll();
      // Remove sensitive fields
      const sanitizedUsers = users.map((user) => {
        const { password_hash, ...rest } = user as any;
        return rest;
      });
      res.json(sanitizedUsers);
    } catch (error) {
      this.logger.error('Error fetching users', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async createUser(req: Request, res: Response) {
    try {
      const user = await this.userService.create(req.body);
      // Remove password from response
      const { password_hash, ...userWithoutPassword } = user as any;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      this.logger.error('Error creating user', error);
      if (error instanceof Error && error.message.includes('exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Bad Request' });
      }
    }
  }

  private async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.userService.delete(parseInt(id, 10));
      res.status(204).send();
    } catch (error) {
      this.logger.error('Error deleting user', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async login(req: Request, res: Response) {
    try {
      // Validation is done by Joi middleware - no need for manual checks
      const { email, password } = req.body;

      // Find user by email
      const user = await this.userService.findByEmail(email);

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if account is locked
      if (user.locked_until && user.locked_until > new Date()) {
        const minutesRemaining = Math.ceil(
          (user.locked_until.getTime() - Date.now()) / (60 * 1000),
        );
        this.logger.warn('Account locked', {
          userId: user.id,
          email: user.email,
          lockedUntil: user.locked_until,
        });
        return res.status(403).json({
          error: 'Account temporarily locked',
          message: `Too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`,
          lockedUntil: user.locked_until,
        });
      }

      // Validate password
      const isValidPassword = await this.userService.validatePassword(user.id, password);

      if (!isValidPassword) {
        // Increment failed attempts and potentially lock account
        await this.userService.handleFailedLogin(user.id);

        this.logger.warn('Failed login attempt', {
          userId: user.id,
          email: user.email,
          failedAttempts: user.failed_login_attempts + 1,
        });

        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Reset failed attempts on successful login
      await this.userService.resetFailedLoginAttempts(user.id);

      // Generate JWT tokens
      const jwtSecret = process.env.JWT_SECRET;
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

      // Critical security check - these MUST be set at startup
      if (!jwtSecret || jwtSecret.length < 32) {
        this.logger.error('JWT_SECRET is not set or is too short (minimum 32 characters)');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
        this.logger.error('JWT_REFRESH_SECRET is not set or is too short (minimum 32 characters)');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, {
        expiresIn: '24h',
      });

      const refreshToken = jwt.sign({ userId: user.id, email: user.email }, jwtRefreshSecret, {
        expiresIn: '7d',
      });

      // Update last login
      await this.userService.updateLastLogin(user.id);

      // Set cookies
      jwtService.setAuthCookies(res, token, refreshToken);

      // If 2FA is enabled, don't return full tokens yet
      if (user.twofa_enabled) {
        // Generate a temporary "pre-auth" token valid for 5 minutes
        const preAuthToken = jwt.sign({ userId: user.id, isPreAuth: true }, jwtSecret, {
          expiresIn: '5m',
        });

        return res.json({
          success: true,
          requires2FA: true,
          preAuthToken,
        });
      }

      // Remove sensitive fields from response
      const userResponse = {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_active: user.is_active,
      };

      res.json({
        success: true,
        token,
        refreshToken,
        user: userResponse,
      });
    } catch (error) {
      this.logger.error('Error during login', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const result = await this.userService.generateResetToken(email);

      if (!result) {
        return res.json({
          success: false,
          emailRegistered: false,
          message: 'Adresa de email nu este înregistrată în sistem.',
        });
      }

      // Send the reset email if the email callback is configured
      if (this.sendPasswordResetEmail) {
        try {
          const userName = `${result.user.first_name} ${result.user.last_name}`;
          await this.sendPasswordResetEmail(email, result.token, userName);
          this.logger.info('Password reset email sent', { email });
        } catch (emailError) {
          this.logger.error('Failed to send password reset email', emailError);
          // Don't expose email sending failures to the user
        }
      } else {
        this.logger.warn('No email sender configured for password reset');
      }

      res.json({
        success: true,
        emailRegistered: true,
        message: 'Am trimis link-ul de resetare a parolei pe email.',
      });
    } catch (error) {
      this.logger.error('Error processing forgot password request', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;

      const success = await this.userService.resetPasswordWithToken(token, password);

      if (!success) {
        return res.status(400).json({
          error: 'Invalid or expired reset token. Please request a new password reset.',
        });
      }

      res.json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
      });
    } catch (error) {
      // Handle password strength validation errors
      if (error instanceof Error && error.message.includes('Password must')) {
        return res.status(400).json({ error: error.message });
      }
      this.logger.error('Error resetting password', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async setup2FA(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const user = await this.userService.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const setup = await this.twoFactorAuthService.generateSecret(user);

      // Store secret temporarily in session or return to client to be sent back during verify
      // For simplicity, we return it to client, but client MUST send it back for verification
      res.json({
        success: true,
        ...setup,
      });
    } catch (error) {
      this.logger.error('Error setting up 2FA', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async verifyAndEnable2FA(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { token, secret } = req.body;
      if (!token || !secret) {
        return res.status(400).json({ error: 'Token and secret are required' });
      }

      const isValid = this.twoFactorAuthService.verifyToken(token, secret);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid token' });
      }

      const backupCodes = this.twoFactorAuthService.generateBackupCodes();
      await this.twoFactorAuthService.enable2FA(userId, secret, backupCodes);

      res.json({
        success: true,
        message: '2FA enabled successfully',
        backupCodes,
      });
    } catch (error) {
      this.logger.error('Error verifying 2FA', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async disable2FA(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { token } = req.body;
      // Verify token before disabling for security
      const user = await this.userService.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      // If 2FA is enabled, we need a token to disable it
      if (user.twofa_enabled) {
        if (!token) return res.status(400).json({ error: 'Token is required to disable 2FA' });

        // Get secret from DB (not selected by default)
        const userWithSecret = await this.userService.getUserWithSecrets(userId);
        const isValid = this.twoFactorAuthService.verifyToken(token, userWithSecret.twofa_secret!);

        if (!isValid) {
          return res.status(400).json({ error: 'Invalid token' });
        }
      }

      await this.twoFactorAuthService.disable2FA(userId);

      res.json({
        success: true,
        message: '2FA disabled successfully',
      });
    } catch (error) {
      this.logger.error('Error disabling 2FA', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async login2FA(req: Request, res: Response) {
    try {
      const { token, preAuthToken, isBackupCode } = req.body;
      if (!token || !preAuthToken) {
        return res.status(400).json({ error: 'Token and preAuthToken are required' });
      }

      // Verify pre-auth token
      const jwtSecret = process.env.JWT_SECRET!;
      let decoded: any;
      try {
        decoded = jwt.verify(preAuthToken, jwtSecret);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired pre-authentication token' });
      }

      if (!decoded.isPreAuth) {
        return res.status(401).json({ error: 'Invalid token type' });
      }

      const userId = decoded.userId;
      const user = await this.userService.getUserWithSecrets(userId);

      if (!user || !user.twofa_enabled) {
        return res.status(400).json({ error: '2FA not enabled for this user' });
      }

      let isValid = false;
      if (isBackupCode) {
        isValid = await this.twoFactorAuthService.verifyBackupCode(user, token);
      } else {
        isValid = this.twoFactorAuthService.verifyToken(token, user.twofa_secret!);
      }

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid 2FA token or backup code' });
      }

      // 2FA Success - Generate full tokens
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '24h' },
      );

      const refreshToken = jwt.sign({ userId: user.id, email: user.email }, jwtRefreshSecret, {
        expiresIn: '7d',
      });

      // Set cookies
      jwtService.setAuthCookies(res, accessToken, refreshToken);

      const userResponse = {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_active: user.is_active,
      };

      res.json({
        success: true,
        token: accessToken,
        refreshToken,
        user: userResponse,
      });
    } catch (error) {
      this.logger.error('Error during 2FA login', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
