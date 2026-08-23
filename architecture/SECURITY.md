# Phase 3 Architecture: Cryptographic Security & Secrets Vaulting

## 1. Timing-Safe HMAC Verification
- **Vulnerability Prevented**: String comparison (`a === b`) terminates on the first mismatched byte, creating timing variations that allow attackers to forge webhook signatures.
- **Implementation**:
  ```typescript
  import * as crypto from 'node:crypto';

  export function verifyHmac(rawBody: Buffer, signature: string, secret: string): boolean {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    const computedBuf = Buffer.from(computed, 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');
    if (computedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, sigBuf);
  }
  ```

## 2. Secrets Encryption at Rest
- API tokens, passwords, and webhook secrets are encrypted with **AES-256-GCM** using a master vault key stored in environment variable `ENCRYPTION_KEY_256`.
- Secrets are decrypted strictly in memory at the moment of API client instantiation.
