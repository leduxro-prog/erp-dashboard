export class InvalidMarginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMarginError';
  }
}
