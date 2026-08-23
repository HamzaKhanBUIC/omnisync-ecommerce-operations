export class IdempotencyGuard {
  private processedKeys: Map<string, { timestamp: number; response?: any }> = new Map();
  private ttlMs: number;

  constructor(ttlMs: number = 86400000) { // 24 hour default TTL
    this.ttlMs = ttlMs;
  }

  public isProcessed(idempotencyKey: string): boolean {
    const record = this.processedKeys.get(idempotencyKey);
    if (!record) return false;

    if (Date.now() - record.timestamp > this.ttlMs) {
      this.processedKeys.delete(idempotencyKey);
      return false;
    }
    return true;
  }

  public isDuplicate(idempotencyKey: string): boolean {
    return this.isProcessed(idempotencyKey);
  }

  public markProcessed(idempotencyKey: string, response?: any): void {
    this.processedKeys.set(idempotencyKey, {
      timestamp: Date.now(),
      response
    });
  }

  public recordEvent(idempotencyKey: string, response?: any): void {
    this.markProcessed(idempotencyKey, response);
  }

  public getResponse(idempotencyKey: string): any {
    return this.processedKeys.get(idempotencyKey)?.response;
  }

  public getCachedResponse(idempotencyKey: string): any {
    return this.getResponse(idempotencyKey);
  }
}
