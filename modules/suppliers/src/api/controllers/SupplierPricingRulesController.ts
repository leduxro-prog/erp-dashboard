import { Request, Response } from 'express';

import { SupplierPricingRule } from '../../domain';
import { successResponse, errorResponse } from '@shared/utils/response';

type SupplierPricingRulesRepository = {
  listSupplierPricingRules(supplierCode: string): Promise<SupplierPricingRule[]>;
  getSupplierPricingRule(
    supplierCode: string,
    categoryKey: string,
  ): Promise<SupplierPricingRule | null>;
  upsertSupplierPricingRule(input: {
    supplierCode: string;
    categoryKey: string;
    markupPercent: number;
    active?: boolean;
  }): Promise<SupplierPricingRule>;
  updateSupplierPricingRuleActive(
    supplierCode: string,
    categoryKey: string,
    active: boolean,
  ): Promise<SupplierPricingRule | null>;
};

const normalizeKey = (value: string): string => value.trim().toLowerCase();

export class SupplierPricingRulesController {
  constructor(private repository: SupplierPricingRulesRepository) {}

  async listBySupplier(req: Request, res: Response): Promise<void> {
    try {
      const supplierCode = normalizeKey(req.params.supplierCode);
      const rules = await this.repository.listSupplierPricingRules(supplierCode);
      res.status(200).json(successResponse(rules, { count: rules.length }));
    } catch (error) {
      res
        .status(500)
        .json(
          errorResponse('INTERNAL_ERROR', 'Internal server error', 500),
        );
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const rule = await this.repository.upsertSupplierPricingRule({
        supplierCode: normalizeKey(req.body.supplierCode),
        categoryKey: normalizeKey(req.body.categoryKey),
        markupPercent: req.body.markupPercent,
        active: req.body.active,
      });

      res.status(201).json(successResponse(rule));
    } catch (error) {
      res
        .status(500)
        .json(
          errorResponse('INTERNAL_ERROR', 'Internal server error', 500),
        );
    }
  }

  async upsertByKey(req: Request, res: Response): Promise<void> {
    try {
      const rule = await this.repository.upsertSupplierPricingRule({
        supplierCode: normalizeKey(req.params.supplierCode),
        categoryKey: normalizeKey(req.params.categoryKey),
        markupPercent: req.body.markupPercent,
        active: req.body.active,
      });

      res.status(200).json(successResponse(rule));
    } catch (error) {
      res
        .status(500)
        .json(
          errorResponse('INTERNAL_ERROR', 'Internal server error', 500),
        );
    }
  }

  async setActive(req: Request, res: Response): Promise<void> {
    try {
      const supplierCode = normalizeKey(req.params.supplierCode);
      const categoryKey = normalizeKey(req.params.categoryKey);
      const active = req.body.active;

      const updatedRule = await this.repository.updateSupplierPricingRuleActive(
        supplierCode,
        categoryKey,
        active,
      );
      if (!updatedRule) {
        res
          .status(404)
          .json(errorResponse('NOT_FOUND', 'Pricing rule not found', 404));
        return;
      }

      res.status(200).json(successResponse(updatedRule));
    } catch (error) {
      res
        .status(500)
        .json(
          errorResponse('INTERNAL_ERROR', 'Internal server error', 500),
        );
    }
  }
}
