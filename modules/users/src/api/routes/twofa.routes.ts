import { Router, Request, Response } from 'express';
import { TwoFactorAuthService } from '../../application/services/TwoFactorAuthService';
import { UserService } from '../../application/services/UserService';
import { authenticate, AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { createModuleLogger } from '@shared/utils/logger';
import * as jwt from 'jsonwebtoken';

const logger = createModuleLogger('2fa-routes');

/**
 * Create 2FA routes
 *
 * POST /2fa/setup        - Generate secret and QR code (requires auth)
 * POST /2fa/verify-setup  - Verify token and enable 2FA (requires auth)
 * POST /2fa/disable       - Disable 2FA with token confirmation (requires auth)
 * POST /2fa/verify        - Verify 2FA token during login (uses pre-auth token)
 */
export function createTwoFactorRoutes(
  userService: UserService,
  twoFactorAuthService: TwoFactorAuthService,
): Router {
  const router = Router();

  // POST /2fa/setup - Generate secret and QR code
  router.post('/setup', authenticate, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await userService.findById(Number(userId));
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (user.twofa_enabled) {
        res.status(400).json({ error: '2FA is already enabled for this account' });
        return;
      }

      const setup = await twoFactorAuthService.generateSecret(user);

      res.json({
        success: true,
        secret: setup.secret,
        otpauthUrl: setup.otpauthUrl,
        qrCodeDataUrl: setup.qrCodeDataUrl,
      });
    } catch (error) {
      logger.error('Error setting up 2FA', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // POST /2fa/verify-setup - Verify token and enable 2FA
  router.post('/verify-setup', authenticate, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { token, secret } = req.body;
      if (!token || !secret) {
        res.status(400).json({ error: 'Token and secret are required' });
        return;
      }

      const isValid = twoFactorAuthService.verifyToken(token, secret);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid verification token' });
        return;
      }

      const backupCodes = twoFactorAuthService.generateBackupCodes();
      await twoFactorAuthService.enable2FA(Number(userId), secret, backupCodes);

      res.json({
        success: true,
        message: '2FA enabled successfully',
        backupCodes,
      });
    } catch (error) {
      logger.error('Error verifying 2FA setup', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // POST /2fa/disable - Disable 2FA
  router.post('/disable', authenticate, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await userService.findById(Number(userId));
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (!user.twofa_enabled) {
        res.status(400).json({ error: '2FA is not enabled' });
        return;
      }

      const { token } = req.body;
      if (!token) {
        res.status(400).json({ error: 'Current 2FA token is required to disable 2FA' });
        return;
      }

      // Verify current token before disabling
      const userWithSecret = await userService.getUserWithSecrets(Number(userId));
      if (!userWithSecret.twofa_secret) {
        res.status(500).json({ error: '2FA secret not found' });
        return;
      }

      const isValid = twoFactorAuthService.verifyToken(token, userWithSecret.twofa_secret);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid 2FA token' });
        return;
      }

      await twoFactorAuthService.disable2FA(Number(userId));

      res.json({
        success: true,
        message: '2FA disabled successfully',
      });
    } catch (error) {
      logger.error('Error disabling 2FA', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // POST /2fa/verify - Verify 2FA token during login (uses pre-auth token)
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const { token, preAuthToken, isBackupCode } = req.body;
      if (!token || !preAuthToken) {
        res.status(400).json({ error: 'Token and preAuthToken are required' });
        return;
      }

      // Verify pre-auth token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      let decoded: { userId: number; isPreAuth?: boolean };
      try {
        decoded = jwt.verify(preAuthToken, jwtSecret) as { userId: number; isPreAuth?: boolean };
      } catch (_err) {
        res.status(401).json({ error: 'Invalid or expired pre-authentication token' });
        return;
      }

      if (!decoded.isPreAuth) {
        res.status(401).json({ error: 'Invalid token type' });
        return;
      }

      const userId = decoded.userId;
      const user = await userService.getUserWithSecrets(userId);

      if (!user || !user.twofa_enabled) {
        res.status(400).json({ error: '2FA not enabled for this user' });
        return;
      }

      let isValid = false;
      if (isBackupCode) {
        isValid = await twoFactorAuthService.verifyBackupCode(user, token);
      } else {
        if (!user.twofa_secret) {
          res.status(500).json({ error: '2FA secret not found' });
          return;
        }
        isValid = twoFactorAuthService.verifyToken(token, user.twofa_secret);
      }

      if (!isValid) {
        res.status(401).json({ error: 'Invalid 2FA token or backup code' });
        return;
      }

      // 2FA verified - issue full auth tokens
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
      if (!jwtRefreshSecret) {
        logger.error('JWT_REFRESH_SECRET not configured');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      const accessToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '24h' },
      );

      const refreshToken = jwt.sign({ userId: user.id, email: user.email }, jwtRefreshSecret, {
        expiresIn: '7d',
      });

      // Update last login
      await userService.updateLastLogin(user.id);

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
      logger.error('Error during 2FA verification', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}
