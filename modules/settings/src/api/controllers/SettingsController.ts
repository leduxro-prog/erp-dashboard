import { NextFunction, Request, Response } from 'express';
import { SettingsService } from '../../application/services/SettingsService';

export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
}
