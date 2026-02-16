
import { Request, Response, NextFunction } from 'express';
import { OfflineTransactionService } from '../../application/services/OfflineTransactionService';

export class OfflineController {
    constructor(private offlineService: OfflineTransactionService) { }

    async syncOffline(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const transactions = req.body.transactions; // Expect array

            if (!Array.isArray(transactions)) {
                res.status(400).json({ error: 'Invalid payload: transactions must be an array' });
                return;
            }

            if (transactions.length === 0) {
                res.status(200).json({ synced: 0, failed: 0, errors: [] });
                return;
            }

            const result = await this.offlineService.syncOfflineTransactions(transactions);

            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    async getSyncStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        // TODO: Implement persistent job tracking if needed.
        // For now, return a placeholder or real status if service supports it.
        res.json({ status: 'ACTIVE', lastSync: new Date() });
    }
}
