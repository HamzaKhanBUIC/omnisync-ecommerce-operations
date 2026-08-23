import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucketLimiter } from '../../src/shared/rateLimiter.ts';

test('TokenBucketLimiter - Consumption and Refill', async () => {
  const limiter = new TokenBucketLimiter(3, 10); // 3 capacity, 10/sec refill

  assert.equal(limiter.tryConsume(2), true);
  assert.equal(limiter.tryConsume(1), true);
  assert.equal(limiter.tryConsume(1), false); // Exhausted

  // Wait 150ms for refill (~1.5 tokens)
  await new Promise(r => setTimeout(r, 150));
  assert.equal(limiter.tryConsume(1), true);
});
