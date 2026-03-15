import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import { Request, Response, Router } from 'express';


import { createModuleLogger } from '../../../shared/utils/logger';

import { AiService } from './AiService';

const AI_ALLOWED_ROLES = ['admin', 'sales', 'finance', 'support', 'supplier_manager', 'warehouse'];

export class AiController {
  private router: Router;
  private logger = createModuleLogger('AiController');

  constructor(private readonly aiService: AiService | null) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(authenticate);
    this.router.post('/chat', requireRole(AI_ALLOWED_ROLES), this.chat.bind(this));
    this.router.post('/analyze-crm', requireRole(AI_ALLOWED_ROLES), this.analyzeCrm.bind(this));
  }

  public getRouter(): Router {
    return this.router;
  }

  private async chat(req: Request, res: Response): Promise<void> {
    try {
      if (!this.aiService) {
        res.status(503).json({ error: 'AI service is not configured' });
        return;
      }

      const { message, context } = req.body;
      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }
      const response = await this.aiService.chat(String(message), String(context || ''));
      res.json({ response });
    } catch (error) {
      this.logger.error('Error processing chat request', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  private async analyzeCrm(req: Request, res: Response): Promise<void> {
    try {
      if (!this.aiService) {
        res.status(503).json({ error: 'AI service is not configured' });
        return;
      }

      const { clients } = req.body;
      if (!clients || !Array.isArray(clients)) {
        res.status(400).json({ error: 'Clients list is required' });
        return;
      }
      const suggestions = await this.aiService.analyzeCrmData(clients);
      res.json({ suggestions });
    } catch (error) {
      this.logger.error('Error analyzing CRM data', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
