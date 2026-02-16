import { Router, Request, Response } from 'express';
import { createModuleLogger } from '../../shared/utils/logger';
import { jwtService, TokenPayload } from '../../shared/services/JwtService';

const logger = createModuleLogger('auth-routes');
const router = Router();

/**
 * POST /api/v1/auth/refresh
 * Reads refresh token from HttpOnly cookie, validates it,
 * and issues a new access + refresh token pair via cookies.
 * Also accepts refresh token in request body for backwards compatibility.
 */
router.post('/refresh', (req: Request, res: Response): void => {
  try {
    // Try cookie first, then request body (backwards compat)
    const cookies = (req as unknown as Record<string, unknown>).cookies as
      | Record<string, string>
      | undefined;
    const refreshToken =
      cookies?.refresh_token ||
      ((req.body as Record<string, unknown>)?.refreshToken as string | undefined);

    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token provided' });
      return;
    }

    let payload: TokenPayload;
    try {
      payload = jwtService.verifyRefreshToken(refreshToken);
    } catch (err) {
      logger.debug('Invalid refresh token presented', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Clear stale cookies
      jwtService.clearAuthCookies(res);
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const tokenPayload: TokenPayload = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    const newAccessToken = jwtService.generateAccessToken(tokenPayload);
    const newRefreshToken = jwtService.generateRefreshToken(tokenPayload);

    // Set new HttpOnly cookies
    jwtService.setAuthCookies(res, newAccessToken, newRefreshToken);

    // Also return tokens in body for backwards compatibility
    res.status(200).json({
      message: 'Tokens refreshed successfully',
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error('Token refresh error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Clears all auth cookies and invalidates the session.
 */
router.post('/logout', (_req: Request, res: Response): void => {
  try {
    jwtService.clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
