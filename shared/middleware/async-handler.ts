/**
 * Async Handler Utility
 * Wraps async Express handlers to properly catch errors and pass to next()
 * Compatible with Express Router overloads
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Type for async route handler functions
 */
export type AsyncHandler<T extends Request = AuthenticatedRequest> = (
  req: T,
  res: Response,
  next: NextFunction,
) => Promise<any>;

/**
 * Wraps an async route handler to catch errors and pass them to next()
 * Returns a properly typed Express RequestHandler for Router compatibility
 * 
 * @param fn - Async route handler function
 * @returns Express RequestHandler
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.findAll();
 *   res.json(users);
 * }));
 */
export function asyncHandler<T extends Request = AuthenticatedRequest>(
  fn: AsyncHandler<T>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}



/**
 * Wraps a controller method with proper binding
 * Useful for class-based controllers
 * 
 * @param controller - Controller instance
 * @param method - Method name to bind
 * @returns Express RequestHandler
 * 
 * @example
 * router.get('/users', wrapController(userController, 'findAll'));
 */
export function wrapController<T extends object>(
  controller: T,
  method: keyof T,
): RequestHandler {
  const fn = controller[method] as unknown as AsyncHandler;
  return asyncHandler(fn.bind(controller));
}
