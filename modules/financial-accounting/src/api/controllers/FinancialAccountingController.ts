import { Request, Response } from 'express';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';
import { CreateChartOfAccountUseCase } from '../../application/use-cases/CreateChartOfAccountUseCase';
import { CreateJournalEntryUseCase } from '../../application/use-cases/CreateJournalEntryUseCase';
import { CreateArInvoiceUseCase } from '../../application/use-cases/CreateArInvoiceUseCase';
import { CreateApInvoiceUseCase } from '../../application/use-cases/CreateApInvoiceUseCase';
import { PostJournalEntryUseCase } from '../../application/use-cases/PostJournalEntryUseCase';
import { GenerateTrialBalanceUseCase } from '../../application/use-cases/GenerateTrialBalanceUseCase';
import { IChartOfAccountRepository } from '../../domain/repositories/IChartOfAccountRepository';
import { IJournalEntryRepository } from '../../domain/repositories/IJournalEntryRepository';
import { IFiscalPeriodRepository } from '../../domain/repositories/IFiscalPeriodRepository';
import { IArInvoiceRepository } from '../../domain/repositories/IArInvoiceRepository';
import { IApInvoiceRepository } from '../../domain/repositories/IApInvoiceRepository';
import { ICostCenterRepository } from '../../domain/repositories/ICostCenterRepository';
import { GeneralLedgerService } from '../../domain/services/GeneralLedgerService';
import { AccountsReceivableService } from '../../domain/services/AccountsReceivableService';
import { AccountsPayableService } from '../../domain/services/AccountsPayableService';

export class FinancialAccountingController {
  constructor(
    private chartOfAccountRepository: IChartOfAccountRepository,
    private journalEntryRepository: IJournalEntryRepository,
    private fiscalPeriodRepository: IFiscalPeriodRepository,
    private arInvoiceRepository: IArInvoiceRepository,
    private apInvoiceRepository: IApInvoiceRepository,
    private costCenterRepository: ICostCenterRepository,
  ) { }

  // Chart of Accounts endpoints
  async createChartOfAccount(req: Request, res: Response): Promise<void> {
    try {
      const useCase = new CreateChartOfAccountUseCase(this.chartOfAccountRepository);
      const result = await useCase.execute({
        ...req.body,
        createdBy: String(req.user?.id || 'system'),
      });
      res.status(201).json(successResponse(result, { message: 'Chart of account created successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getChartOfAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const { isActive, parentAccountId, page = 1, limit = 20 } = req.query;

      const filters: any = {};
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (parentAccountId) filters.parentAccountId = parentAccountId as string;

      const accounts = await this.chartOfAccountRepository.findAll(organizationId as string, filters);

      const startIdx = ((page as number) - 1) * (limit as number);
      const endIdx = startIdx + (limit as number);
      const paginatedAccounts = accounts.slice(startIdx, endIdx);

      res.json(
        paginatedResponse(paginatedAccounts, page as number, limit as number, accounts.length),
      );
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getChartOfAccountById(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, accountId } = req.params;
      const account = await this.chartOfAccountRepository.findById(accountId, organizationId);

      if (!account) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Account not found'));
        return;
      }

      res.json(successResponse(account));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // Journal Entry endpoints
  async createJournalEntry(req: Request, res: Response): Promise<void> {
    try {
      const useCase = new CreateJournalEntryUseCase(
        this.journalEntryRepository,
        this.chartOfAccountRepository,
        this.fiscalPeriodRepository,
      );

      const result = await useCase.execute({
        ...req.body,
        createdBy: String(req.user?.id || 'system'),
      });

      res.status(201).json(successResponse(result, { message: 'Journal entry created successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getJournalEntry(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, entryId } = req.params;
      const entry = await this.journalEntryRepository.findById(entryId, organizationId);

      if (!entry) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Journal entry not found'));
        return;
      }

      res.json(successResponse(entry));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async postJournalEntry(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, entryId } = req.params;
      const userId = String(req.user?.id || 'system');

      const useCase = new PostJournalEntryUseCase(
        this.journalEntryRepository,
        this.chartOfAccountRepository,
        this.fiscalPeriodRepository,
      );

      const result = await useCase.execute(entryId, organizationId, userId);
      res.json(successResponse(result, { message: 'Journal entry posted successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async approveJournalEntry(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, entryId } = req.params;
      const userId = String(req.user?.id || 'system');

      const glService = new GeneralLedgerService(
        this.journalEntryRepository,
        this.chartOfAccountRepository,
        this.fiscalPeriodRepository,
      );

      const entry = await this.journalEntryRepository.findById(entryId, organizationId);
      if (!entry) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Journal entry not found'));
        return;
      }

      const approved = await glService.approveJournalEntry(entry, userId);
      res.json(successResponse(approved, { message: 'Journal entry approved successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // Trial Balance endpoint
  async generateTrialBalance(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, fiscalPeriodId } = req.params;

      const useCase = new GenerateTrialBalanceUseCase(
        this.journalEntryRepository,
        this.chartOfAccountRepository,
        this.fiscalPeriodRepository,
      );

      const result = await useCase.execute(organizationId, fiscalPeriodId);
      res.json(successResponse(result, { message: 'Trial balance generated successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async generateIncomeStatement(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const { fromDate, toDate, comparisionFromDate, comparisionToDate } = req.query;

      const glService = new GeneralLedgerService(
        this.journalEntryRepository,
        this.chartOfAccountRepository,
        this.fiscalPeriodRepository,
      );

      const result = await glService.generateIncomeStatement(
        organizationId,
        new Date(fromDate as string),
        new Date(toDate as string),
        comparisionFromDate ? new Date(comparisionFromDate as string) : undefined,
        comparisionToDate ? new Date(comparisionToDate as string) : undefined,
      );

      res.json(successResponse(result, { message: 'Income statement generated successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async generateBalanceSheet(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const { asOfDate = new Date() } = req.query;

      const glService = new GeneralLedgerService(
        this.journalEntryRepository,
        this.chartOfAccountRepository,
        this.fiscalPeriodRepository,
      );

      const result = await glService.generateBalanceSheet(organizationId, new Date(asOfDate as string));
      res.json(successResponse(result, { message: 'Balance sheet generated successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // AR Invoice endpoints
  async createArInvoice(req: Request, res: Response): Promise<void> {
    try {
      const useCase = new CreateArInvoiceUseCase(
        this.arInvoiceRepository,
        this.chartOfAccountRepository,
      );

      const result = await useCase.execute({
        ...req.body,
        createdBy: String(req.user?.id || 'system'),
      });

      res.status(201).json(successResponse(result, { message: 'AR invoice created successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getArInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, invoiceId } = req.params;
      const invoice = await this.arInvoiceRepository.findById(invoiceId, organizationId);

      if (!invoice) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Invoice not found'));
        return;
      }

      res.json(successResponse(invoice));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async recordArPayment(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, invoiceId } = req.params;
      const { amount } = req.body;
      const userId = String(req.user?.id || 'system');

      const arService = new AccountsReceivableService(this.arInvoiceRepository);
      const result = await arService.recordPayment(invoiceId, amount, organizationId, userId);

      res.json(successResponse(result, { message: 'Payment recorded successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getArAging(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const { customerId, asOfDate = new Date() } = req.query;

      const arService = new AccountsReceivableService(this.arInvoiceRepository);

      if (customerId) {
        const result = await arService.getAgingAnalysis(
          customerId as string,
          organizationId,
          new Date(asOfDate as string),
        );
        res.json(successResponse(result));
      } else {
        const result = await arService.getAgingAnalysisByOrganization(
          organizationId,
          new Date(asOfDate as string),
        );
        res.json(successResponse(Array.from(result.values())));
      }
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  // AP Invoice endpoints
  async createApInvoice(req: Request, res: Response): Promise<void> {
    try {
      const useCase = new CreateApInvoiceUseCase(
        this.apInvoiceRepository,
        this.chartOfAccountRepository,
      );

      const result = await useCase.execute({
        ...req.body,
        createdBy: String(req.user?.id || 'system'),
      });

      res.status(201).json(successResponse(result, { message: 'AP invoice created successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getApInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, invoiceId } = req.params;
      const invoice = await this.apInvoiceRepository.findById(invoiceId, organizationId);

      if (!invoice) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Invoice not found'));
        return;
      }

      res.json(successResponse(invoice));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async recordApPayment(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, invoiceId } = req.params;
      const { amount, discountTaken } = req.body;
      const userId = String(req.user?.id || 'system');

      const apService = new AccountsPayableService(this.apInvoiceRepository);
      const result = await apService.recordPayment(
        invoiceId,
        amount,
        organizationId,
        userId,
        discountTaken,
      );

      res.json(successResponse(result, { message: 'Payment recorded successfully' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async performThreeWayMatch(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId, invoiceId } = req.params;
      const { poAmount, grnAmount, tolerancePercent } = req.body;
      const userId = String(req.user?.id || 'system');

      const apService = new AccountsPayableService(this.apInvoiceRepository);
      const result = await apService.performThreeWayMatch(
        invoiceId,
        poAmount,
        grnAmount,
        organizationId,
        userId,
        tolerancePercent,
      );

      res.json(successResponse(result, { message: 'Three-way match completed' }));
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getApAging(req: Request, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const { vendorId, asOfDate = new Date() } = req.query;

      const apService = new AccountsPayableService(this.apInvoiceRepository);

      if (vendorId) {
        const result = await apService.getAgingAnalysis(
          vendorId as string,
          organizationId,
          new Date(asOfDate as string),
        );
        res.json(successResponse(result));
      } else {
        const result = await apService.getAgingAnalysisByOrganization(
          organizationId,
          new Date(asOfDate as string),
        );
        res.json(successResponse(Array.from(result.values())));
      }
    } catch (error) {
      res.status(400).json(errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}
