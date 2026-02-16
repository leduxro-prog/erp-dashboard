import { Request, Response, NextFunction } from 'express';
import { AuditLogService } from '../services/AuditLogService';

/**
 * Factory to create audit middleware
 * @param auditService Instance of AuditLogService
 * @param resourceType Name of the resource being accessed (e.g., 'Order')
 */
export const createAuditMiddleware = (
  auditService: AuditLogService,
  resourceType: string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    const originalSend = res.send;
    
    // Override res.json to capture the response and log after it's sent
    res.json = function (body: any) {
      res.json = originalJson;
      const result = originalJson.call(this, body);
      
      // Log successful state-changing operations
      if (res.statusCode >= 200 && res.statusCode < 300 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const userId = (req as any).user?.id;
        const action = mapMethodToAction(req.method);
        const resourceId = req.params.id || body?.id || body?.data?.id;

        auditService.log({
          userId,
          action,
          resourceType,
          resourceId: resourceId ? String(resourceId) : undefined,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
          }
        });
      }
      
      return result;
    };

    next();
  };
};

function mapMethodToAction(method: string): string {
  switch (method) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return method;
  }
}
