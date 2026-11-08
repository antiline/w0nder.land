export class MoccoReadError extends Error {
  constructor(message: string) {
    super(`[mocco-posts] ${message}`);
    this.name = 'MoccoReadError';
  }
}
