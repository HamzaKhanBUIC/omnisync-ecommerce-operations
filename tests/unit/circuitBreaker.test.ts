import { test } from 'node:test';
import * as assert from 'node:assert';
import { CircuitBreaker } from '../../src/shared/circuitBreaker.ts';

test('Circuit Breaker - State Machine Transitions and Threshold Tripping', async () => {
  const breaker = new CircuitBreaker(3, 50); // Threshold 3, 50ms cooldown

  assert.strictEqual(breaker.getState(), 'CLOSED', 'Initial state must be CLOSED');
  assert.strictEqual(breaker.canExecute(), true);

  // 1. Record 2 failures (under threshold)
  breaker.recordFailure();
  breaker.recordFailure();
  assert.strictEqual(breaker.getState(), 'CLOSED');

  // 2. 3rd failure trips the breaker to OPEN
  breaker.recordFailure();
  assert.strictEqual(breaker.getState(), 'OPEN', 'Breaker must transition to OPEN at threshold');
  assert.strictEqual(breaker.canExecute(), false, 'Execution must be blocked when OPEN');

  // 3. Wait for cooldown expiration -> HALF_OPEN
  await new Promise(r => setTimeout(r, 60));
  assert.strictEqual(breaker.getState(), 'HALF_OPEN', 'Breaker transitions to HALF_OPEN after cooldown');
  assert.strictEqual(breaker.canExecute(), true);

  // 4. Successful execution in HALF_OPEN resets state to CLOSED
  breaker.recordSuccess();
  assert.strictEqual(breaker.getState(), 'CLOSED', 'Success in HALF_OPEN recovers breaker to CLOSED');
});
