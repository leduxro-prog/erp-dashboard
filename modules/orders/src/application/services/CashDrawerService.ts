/**
 * Cash Drawer Service
 * Manages POS cash drawer sessions and movements.
 */

import { DataSource, Repository } from 'typeorm';
import { CashDrawerSessionEntity, DrawerSessionStatus } from '../../infrastructure/entities/CashDrawerSessionEntity';
import { CashDrawerMovementEntity, CashMovementType } from '../../infrastructure/entities/CashDrawerMovementEntity';

export interface OpenDrawerInput {
    terminalId: string;
    userId: string;
    openingAmount: number;
}

export interface CloseDrawerInput {
    sessionId: string;
    userId: string;
    actualClosingAmount: number;
    notes?: string;
}

export interface CashMovementInput {
    sessionId: string;
    userId: string;
    type: CashMovementType;
    amount: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
}

export class CashDrawerService {
    private sessionRepo: Repository<CashDrawerSessionEntity>;
    private movementRepo: Repository<CashDrawerMovementEntity>;

    constructor(private dataSource: DataSource) {
        this.sessionRepo = dataSource.getRepository(CashDrawerSessionEntity);
        this.movementRepo = dataSource.getRepository(CashDrawerMovementEntity);
    }

    /**
     * Open a new cash drawer session.
     */
    async openDrawer(input: OpenDrawerInput): Promise<CashDrawerSessionEntity> {
        // Check if there's already an open session for this terminal
        const existingOpen = await this.sessionRepo.findOne({
            where: {
                terminal_id: input.terminalId,
                status: DrawerSessionStatus.OPEN,
            },
        });

        if (existingOpen) {
            throw new Error(`Terminal ${input.terminalId} already has an open drawer session`);
        }

        const session = this.sessionRepo.create({
            terminal_id: input.terminalId,
            opened_by: input.userId,
            opening_amount: input.openingAmount,
            status: DrawerSessionStatus.OPEN,
        });

        const savedSession = await this.sessionRepo.save(session);

        // Record opening movement
        await this.recordMovement({
            sessionId: savedSession.id,
            userId: input.userId,
            type: CashMovementType.OPENING,
            amount: input.openingAmount,
        });

        return savedSession;
    }

    /**
     * Close a cash drawer session.
     */
    async closeDrawer(input: CloseDrawerInput): Promise<CashDrawerSessionEntity> {
        const session = await this.sessionRepo.findOne({
            where: { id: input.sessionId },
        });

        if (!session) {
            throw new Error('Session not found');
        }

        if (session.status !== DrawerSessionStatus.OPEN) {
            throw new Error('Session is not open');
        }

        // Calculate expected closing amount
        const expectedClosingAmount =
            parseFloat(String(session.opening_amount)) +
            parseFloat(String(session.cash_sales_total)) -
            parseFloat(String(session.cash_refunds_total)) +
            parseFloat(String(session.cash_in_total)) -
            parseFloat(String(session.cash_out_total));

        const variance = input.actualClosingAmount - expectedClosingAmount;

        await this.sessionRepo.update(input.sessionId, {
            status: DrawerSessionStatus.CLOSED,
            closed_by: input.userId,
            closed_at: new Date(),
            expected_closing_amount: expectedClosingAmount,
            actual_closing_amount: input.actualClosingAmount,
            variance: variance,
            variance_notes: input.notes,
        });

        // Record closing movement
        await this.recordMovement({
            sessionId: input.sessionId,
            userId: input.userId,
            type: CashMovementType.CLOSING,
            amount: input.actualClosingAmount,
            notes: variance !== 0 ? `Variance: ${variance.toFixed(2)}` : undefined,
        });

        return (await this.sessionRepo.findOne({ where: { id: input.sessionId } }))!;
    }

    /**
     * Record a cash movement.
     */
    async recordMovement(input: CashMovementInput): Promise<CashDrawerMovementEntity> {
        const session = await this.sessionRepo.findOne({
            where: { id: input.sessionId },
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // Calculate new balance
        let currentBalance =
            parseFloat(String(session.opening_amount)) +
            parseFloat(String(session.cash_sales_total)) -
            parseFloat(String(session.cash_refunds_total)) +
            parseFloat(String(session.cash_in_total)) -
            parseFloat(String(session.cash_out_total));

        let balanceAfter = currentBalance;

        // Update session totals based on movement type
        const updates: Partial<CashDrawerSessionEntity> = {};

        switch (input.type) {
            case CashMovementType.SALE:
                updates.cash_sales_total = parseFloat(String(session.cash_sales_total)) + input.amount;
                balanceAfter += input.amount;
                break;
            case CashMovementType.REFUND:
                updates.cash_refunds_total = parseFloat(String(session.cash_refunds_total)) + input.amount;
                balanceAfter -= input.amount;
                break;
            case CashMovementType.CASH_IN:
                updates.cash_in_total = parseFloat(String(session.cash_in_total)) + input.amount;
                balanceAfter += input.amount;
                break;
            case CashMovementType.CASH_OUT:
                updates.cash_out_total = parseFloat(String(session.cash_out_total)) + input.amount;
                balanceAfter -= input.amount;
                break;
        }

        if (Object.keys(updates).length > 0) {
            await this.sessionRepo.update(input.sessionId, updates);
        }

        const movement = this.movementRepo.create({
            session_id: input.sessionId,
            movement_type: input.type,
            amount: input.amount,
            balance_after: balanceAfter,
            reference_type: input.referenceType || null,
            reference_id: input.referenceId || null,
            notes: input.notes || null,
            created_by: input.userId,
        });

        return await this.movementRepo.save(movement);
    }

    /**
     * Get current open session for a terminal.
     */
    async getOpenSession(terminalId: string): Promise<CashDrawerSessionEntity | null> {
        return await this.sessionRepo.findOne({
            where: {
                terminal_id: terminalId,
                status: DrawerSessionStatus.OPEN,
            },
        });
    }

    /**
     * Get session movements.
     */
    async getSessionMovements(sessionId: string): Promise<CashDrawerMovementEntity[]> {
        return await this.movementRepo.find({
            where: { session_id: sessionId },
            order: { created_at: 'ASC' },
        });
    }

    /**
     * Get session summary with all movements.
     */
    async getSessionSummary(sessionId: string) {
        const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
        if (!session) {
            throw new Error('Session not found');
        }

        const movements = await this.getSessionMovements(sessionId);

        return {
            session,
            movements,
            summary: {
                openingAmount: session.opening_amount,
                cashSales: session.cash_sales_total,
                cashRefunds: session.cash_refunds_total,
                cashIn: session.cash_in_total,
                cashOut: session.cash_out_total,
                expectedBalance:
                    parseFloat(String(session.opening_amount)) +
                    parseFloat(String(session.cash_sales_total)) -
                    parseFloat(String(session.cash_refunds_total)) +
                    parseFloat(String(session.cash_in_total)) -
                    parseFloat(String(session.cash_out_total)),
                transactionCount: movements.length,
            },
        };
    }
}
