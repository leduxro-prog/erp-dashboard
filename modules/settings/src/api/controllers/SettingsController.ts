import { NextFunction, Request, Response } from 'express';

import { SettingsService } from '../../application/services/SettingsService';
import { getBrandVisualShortlist } from '@shared/utils/brand-strategy';

export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const settings = await this.settingsService.getPublicSettings();
            res.status(200).json(settings);
        } catch (error) {
            next(error);
        }
    };

    getPrivateSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const settings = await this.settingsService.getSettings();
            res.status(200).json(settings);
        } catch (error) {
            next(error);
        }
    };

    updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const settings = await this.settingsService.updateSettings(req.body);
            res.status(200).json(settings);
        } catch (error) {
            next(error);
        }
    };

    getBrandStrategy = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const brandStrategy = await this.settingsService.getBrandStrategy();
            res.status(200).json({ brandStrategy });
        } catch (error) {
            next(error);
        }
    };

    updateBrandDirection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const selectedDirection = String(req.body?.selectedDirection || '');
            const allowedDirections = new Set(['technical_premium', 'warm_residential', 'hybrid_commerce']);
            if (!selectedDirection) {
                res.status(400).json({ error: 'selectedDirection is required' });
                return;
            }
            if (!allowedDirections.has(selectedDirection)) {
                res.status(400).json({ error: 'selectedDirection is invalid' });
                return;
            }
            const brandStrategy = await this.settingsService.updateBrandDirection(
                selectedDirection as 'technical_premium' | 'warm_residential' | 'hybrid_commerce',
            );
            res.status(200).json({ brandStrategy });
        } catch (error) {
            next(error);
        }
    };

    getBrandVisualShortlist = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            res.status(200).json({
                directions: getBrandVisualShortlist(),
            });
        } catch (error) {
            next(error);
        }
    };
}
