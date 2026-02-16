export class WorkflowError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class TemplateNotFoundError extends WorkflowError {
  constructor(id: string) {
    super('TEMPLATE_NOT_FOUND', `Workflow template ${id} not found`, 404);
  }
}

export class InstanceNotFoundError extends WorkflowError {
  constructor(id: string) {
    super('INSTANCE_NOT_FOUND', `Workflow instance ${id} not found`, 404);
  }
}

export class InvalidTemplateError extends WorkflowError {
  constructor(message: string) {
    super('INVALID_TEMPLATE', message, 400);
  }
}

export class InvalidInstanceStateError extends WorkflowError {
  constructor(message: string) {
    super('INVALID_INSTANCE_STATE', message, 400);
  }
}

export class UnauthorizedApprovalError extends WorkflowError {
  constructor(userId: string) {
    super('UNAUTHORIZED_APPROVAL', `User ${userId} is not authorized to approve this step`, 403);
  }
}

export class WorkflowAlreadyCompletedError extends WorkflowError {
  constructor() {
    super('WORKFLOW_COMPLETED', 'Workflow has already been completed', 400);
  }
}

export class InvalidApprovalDecisionError extends WorkflowError {
  constructor(message: string) {
    super('INVALID_APPROVAL', message, 400);
  }
}
