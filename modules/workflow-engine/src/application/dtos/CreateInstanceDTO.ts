export class CreateInstanceDTO {
  templateId!: string;
  entityType!: string;
  entityId!: string;
  metadata?: Record<string, any>;
}

export class ApproveDTO {
  decision!: 'approved' | 'rejected';
  comment?: string;
}

export class EscalateDTO {
  reason!: string;
}

export class DelegateDTO {
  toUserId!: string;
  reason?: string;
  expiresAt!: Date;
}
