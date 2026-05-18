import { Response } from 'express';
import { DataSource, Repository } from 'typeorm';

import { UserEntity } from '@modules/users/src/domain/entities/UserEntity';
import { successResponse, errorResponse } from '@shared/utils/response';

import { B2BSubAccountEntity, B2BSubAccountPermissions } from '../../infrastructure/entities/B2BSubAccountEntity';

/**
 * B2B Team Controller
 * Handles sub-account management and permissions
 */
export class B2BTeamController {
  private subAccountRepo: Repository<B2BSubAccountEntity>;
  private userRepo: Repository<UserEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.subAccountRepo = this.dataSource.getRepository(B2BSubAccountEntity);
    this.userRepo = this.dataSource.getRepository(UserEntity);
  }

  /**
   * List all sub-accounts for the authenticated Master customer
   */
  async listTeam(req: any, res: Response): Promise<void> {
    try {
      const masterCustomerId = req.user?.customerId || req.b2bCustomer?.id;
      if (!masterCustomerId) {
        res.status(403).json(errorResponse('FORBIDDEN', 'Customer context missing', 403));
        return;
      }

      const team = await this.subAccountRepo.find({
        where: { master_customer_id: masterCustomerId },
        relations: ['user'],
        order: { created_at: 'DESC' }
      });

      res.json(successResponse(team));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list team', 500));
    }
  }

  /**
   * Invite a new sub-account member
   */
  async inviteMember(req: any, res: Response): Promise<void> {
    try {
      const masterCustomerId = req.user?.customerId || req.b2bCustomer?.id;
      const { email, permissions, monthly_limit } = req.body;

      if (!email || !permissions) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'Email and permissions are required', 400));
        return;
      }

      // 1. Check if user exists
      let user = await this.userRepo.findOne({ where: { email } });
      if (!user) {
        // For production, we would trigger a "User Invite" flow here.
        // For this task, we assume the user must already exist in the system.
        res.status(404).json(errorResponse('NOT_FOUND', 'User with this email does not exist', 404));
        return;
      }

      // 2. Check if already a sub-account
      const existing = await this.subAccountRepo.findOne({ 
        where: { master_customer_id: masterCustomerId, user_id: user.id } 
      });
      if (existing) {
        res.status(409).json(errorResponse('CONFLICT', 'User is already a member of your team', 409));
        return;
      }

      // 3. Create sub-account
      const subAccount = this.subAccountRepo.create({
        master_customer_id: masterCustomerId,
        user_id: user.id,
        permissions: permissions as B2BSubAccountPermissions,
        monthly_limit: monthly_limit || 0,
        current_month_spend: 0
      });

      await this.subAccountRepo.save(subAccount);
      res.status(201).json(successResponse(subAccount));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to invite member', 500));
    }
  }

  /**
   * Update sub-account permissions or limits
   */
  async updateMember(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { permissions, monthly_limit } = req.body;
      const masterCustomerId = req.user?.customerId || req.b2bCustomer?.id;

      const subAccount = await this.subAccountRepo.findOne({ 
        where: { id, master_customer_id: masterCustomerId } 
      });

      if (!subAccount) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Sub-account not found', 404));
        return;
      }

      if (permissions) subAccount.permissions = permissions;
      if (monthly_limit !== undefined) subAccount.monthly_limit = monthly_limit;

      await this.subAccountRepo.save(subAccount);
      res.json(successResponse(subAccount));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update member', 500));
    }
  }

  /**
   * Remove a sub-account
   */
  async removeMember(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const masterCustomerId = req.user?.customerId || req.b2bCustomer?.id;

      const subAccount = await this.subAccountRepo.findOne({ 
        where: { id, master_customer_id: masterCustomerId } 
      });

      if (!subAccount) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Sub-account not found', 404));
        return;
      }

      await this.subAccountRepo.remove(subAccount);
      res.json(successResponse({ deleted: true }));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to remove member', 500));
    }
  }
}
