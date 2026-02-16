import { Request, Response, NextFunction } from 'express';
import { PerformanceService } from '../../domain/services/PerformanceService';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class PerformanceController {
    constructor(private performanceService: PerformanceService) { }

    createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const review = await this.performanceService.createPerformanceReview(req.body, String(req.user?.id || 'system'));
            res.status(201).json(successResponse(review));
        } catch (error) {
            next(error);
        }
    };

    getReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const review = await this.performanceService.getPerformanceReview(req.params.id);
            res.status(200).json(successResponse(review));
        } catch (error) {
            next(error);
        }
    };

    updateReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const review = await this.performanceService.updatePerformanceReview(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(review));
        } catch (error) {
            next(error);
        }
    };

    submitReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const review = await this.performanceService.submitPerformanceReview(req.params.id, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(review));
        } catch (error) {
            next(error);
        }
    };

    approveReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const review = await this.performanceService.approvePerformanceReview(req.params.id, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(review));
        } catch (error) {
            next(error);
        }
    };

    acknowledgeReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const review = await this.performanceService.acknowledgePerformanceReview(req.params.id, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(review));
        } catch (error) {
            next(error);
        }
    };

    listReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { data, total } = await this.performanceService.listPerformanceReviews(req.query as any);
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            res.status(200).json(paginatedResponse(data, total, page, limit));
        } catch (error) {
            next(error);
        }
    };

    createKPI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const kpi = await this.performanceService.createPerformanceKPI(req.body, String(req.user?.id || 'system'));
            res.status(201).json(successResponse(kpi));
        } catch (error) {
            next(error);
        }
    };

    getKPI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const kpi = await this.performanceService.getPerformanceKPI(req.params.id);
            res.status(200).json(successResponse(kpi));
        } catch (error) {
            next(error);
        }
    };

    updateKPI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const kpi = await this.performanceService.updatePerformanceKPI(req.params.id, req.body, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(kpi));
        } catch (error) {
            next(error);
        }
    };

    getEmployeeKPIs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const kpis = await this.performanceService.getEmployeeKPIs(
                req.params.employeeId,
                parseInt(req.params.year)
            );
            res.status(200).json(successResponse(kpis));
        } catch (error) {
            next(error);
        }
    };

    createRatings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ratings = await this.performanceService.createPerformanceRatings(
                req.params.reviewId,
                req.body.ratings,
                String(req.user?.id || 'system')
            );
            res.status(201).json(successResponse(ratings));
        } catch (error) {
            next(error);
        }
    };

    updateRating = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const rating = await this.performanceService.updatePerformanceRating(
                req.params.id,
                req.body.rating,
                req.body.feedback,
                String(req.user?.id || 'system')
            );
            res.status(200).json(successResponse(rating));
        } catch (error) {
            next(error);
        }
    };

    getReviewRatings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const ratings = await this.performanceService.getReviewRatings(req.params.reviewId);
            res.status(200).json(successResponse(ratings));
        } catch (error) {
            next(error);
        }
    };

    calculateOverallRating = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const review = await this.performanceService.calculateOverallRating(req.params.reviewId, String(req.user?.id || 'system'));
            res.status(200).json(successResponse(review));
        } catch (error) {
            next(error);
        }
    };
}
