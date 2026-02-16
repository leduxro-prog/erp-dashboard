import { Router, Request, Response } from 'express';
import { LoginB2BCustomer } from '../../application/use-cases/LoginB2BCustomer';
import { RefreshB2BToken } from '../../application/use-cases/RefreshB2BToken';
import { ForgotB2BPassword } from '../../application/use-cases/ForgotB2BPassword';
import { ResetB2BPassword } from '../../application/use-cases/ResetB2BPassword';
import {
  validateBody,
  b2bLoginSchema,
  b2bRefreshTokenSchema,
  b2bForgotPasswordSchema,
  b2bResetPasswordSchema,
} from '../validators/b2b-auth.validators';
import { authRateLimiter } from '../../../../../src/middleware/rate-limiter';

export class B2BAuthController {
  private router: Router;

  constructor(
    private loginB2BCustomer: LoginB2BCustomer,
    private refreshB2BToken: RefreshB2BToken,
    private forgotB2BPassword: ForgotB2BPassword,
    private resetB2BPassword: ResetB2BPassword,
    private sendPasswordResetEmail?: (
      email: string,
      resetToken: string,
      customerName: string,
    ) => Promise<void>,
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * @route POST /api/v1/b2b-auth/login
     * @desc B2B customer login
     * @access Public
     */
    this.router.post(
      '/login',
      authRateLimiter,
      validateBody(b2bLoginSchema),
      this.login.bind(this),
    );

    /**
     * @route POST /api/v1/b2b-auth/refresh
     * @desc Refresh B2B access token
     * @access Public (requires valid refresh token)
     */
    this.router.post('/refresh', validateBody(b2bRefreshTokenSchema), this.refresh.bind(this));

    /**
     * @route POST /api/v1/b2b-auth/forgot-password
     * @desc Request B2B password reset email
     * @access Public
     */
    this.router.post(
      '/forgot-password',
      authRateLimiter,
      validateBody(b2bForgotPasswordSchema),
      this.forgotPassword.bind(this),
    );

    /**
     * @route POST /api/v1/b2b-auth/reset-password
     * @desc Reset B2B password using reset token
     * @access Public
     */
    this.router.post(
      '/reset-password',
      validateBody(b2bResetPasswordSchema),
      this.resetPassword.bind(this),
    );

    /**
     * @route POST /api/v1/b2b-auth/logout
     * @desc B2B customer logout (client-side token removal)
     * @access Public
     */
    this.router.post('/logout', this.logout.bind(this));
  }

  /**
   * Handle B2B customer login
   */
  private async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await this.loginB2BCustomer.execute({
        email,
        password,
      });

      if (!result.success) {
        const statusCode = result.locked_until ? 423 : 401;
        res.status(statusCode).json({
          error: result.error,
          locked_until: result.locked_until,
        });
        return;
      }

      res.status(200).json({
        message: 'Login successful',
        token: result.token,
        refresh_token: result.refresh_token,
        customer: result.customer,
      });
    } catch (error) {
      console.error('B2B login error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Login failed',
      });
    }
  }

  /**
   * Handle B2B token refresh
   */
  private async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      const result = await this.refreshB2BToken.execute({
        refresh_token,
      });

      if (!result.success) {
        res.status(401).json({
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        message: 'Token refreshed successfully',
        token: result.token,
        refresh_token: result.refresh_token,
      });
    } catch (error) {
      console.error('B2B token refresh error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Token refresh failed',
      });
    }
  }

  /**
   * Handle B2B forgot password
   */
  private async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      const result = await this.forgotB2BPassword.execute({ email });

      if (!result.emailRegistered) {
        res.status(200).json({
          success: false,
          emailRegistered: false,
          message: 'Adresa de email nu este înregistrată în sistem.',
        });
        return;
      }

      if (result.token && result.email && this.sendPasswordResetEmail) {
        try {
          await this.sendPasswordResetEmail(
            result.email,
            result.token,
            result.customerName || 'Client B2B',
          );
        } catch (emailError) {
          console.error('Failed to send B2B reset password email:', emailError);
        }
      }

      res.status(200).json({
        success: true,
        emailRegistered: true,
        message: 'Am trimis link-ul de resetare a parolei pe email.',
      });
    } catch (error) {
      console.error('B2B forgot password error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process forgot password request',
      });
    }
  }

  /**
   * Handle B2B reset password
   */
  private async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body;

      const result = await this.resetB2BPassword.execute({ token, password });
      if (!result.success) {
        res.status(400).json({
          error: result.error || 'Failed to reset password',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
      });
    } catch (error) {
      console.error('B2B reset password error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to reset password',
      });
    }
  }

  /**
   * Handle B2B customer logout
   * Note: JWT is stateless, so logout is handled client-side by removing tokens
   */
  private async logout(req: Request, res: Response): Promise<void> {
    // In a stateless JWT setup, logout is handled client-side
    // This endpoint exists for consistency and future session management
    res.status(200).json({
      message: 'Logout successful',
    });
  }

  getRouter(): Router {
    return this.router;
  }
}
