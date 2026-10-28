import test from 'node:test';
import assert from 'node:assert/strict';
import { IdempotencyGuard } from '../../src/backend/idempotencyGuard.ts';

test('IdempotencyGuard - Deduplication caching and basic marking', () => {
  const guard = new IdempotencyGuard();
  const eventId = 'evt_shopify_order_created_987654';

  // Initially untracked
  assert.equal(guard.isProcessed(eventId), false);
  assert.equal(guard.getResponse(eventId), undefined);

  // Mark as processed with response payload
  const responseData = {
    orderId: 'ord_shp_987654',
    status: 'COMMITTED',
    ledgerEntryId: 'ledg_102938',
    broadcastStores: ['store_woo_eu', 'store_pos_retail']
  };
  guard.markProcessed(eventId, responseData);

  // Subsequent check should return true and cached response
  assert.equal(guard.isProcessed(eventId), true);
  assert.deepEqual(guard.getResponse(eventId), responseData);
});

test('IdempotencyGuard - Duplicate event ID replay resilience (AC-2)', () => {
  const guard = new IdempotencyGuard();
  const replayEventId = 'evt_webhook_replay_attack_001';
  const responsePayload = { orderId: 'ord_replay_001', processed: true };

  // First arrival
  assert.equal(guard.isProcessed(replayEventId), false);
  guard.markProcessed(replayEventId, responsePayload);

  // Simulate 50 identical incoming webhook replays (AC-2 compliance)
  for (let i = 1; i <= 50; i++) {
    const isDuplicate = guard.isProcessed(replayEventId);
    assert.equal(isDuplicate, true, `Replay iteration ${i} must be flagged as already processed`);
    assert.deepEqual(guard.getResponse(replayEventId), responsePayload);
  }
});

test('IdempotencyGuard - TTL expiration and cache eviction', async () => {
  // Create guard with a 50ms short TTL
  const shortTtlMs = 50;
  const guard = new IdempotencyGuard(shortTtlMs);
  const tempKey = 'evt_temp_session_key_abc';

  guard.markProcessed(tempKey, { status: 'temporary' });

  // Immediately active
  assert.equal(guard.isProcessed(tempKey), true);
  assert.equal(guard.getResponse(tempKey)?.status, 'temporary');

  // Wait for TTL to expire (+30ms buffer)
  await new Promise(resolve => setTimeout(resolve, shortTtlMs + 30));

  // Should now report as not processed and evict record
  assert.equal(guard.isProcessed(tempKey), false, 'Key must be expired and pruned after TTL');
});

test('IdempotencyGuard - Independent multi-key tracking with selective TTL expiration', async () => {
  const shortTtlMs = 60;
  const guard = new IdempotencyGuard(shortTtlMs);

  const key1 = 'evt_early_key_001';
  const key2 = 'evt_late_key_002';

  // Mark key1 at t=0
  guard.markProcessed(key1, { index: 1 });

  // Wait 40ms, then mark key2 at t=40
  await new Promise(resolve => setTimeout(resolve, 40));
  guard.markProcessed(key2, { index: 2 });

  // At t=40, both keys should be active
  assert.equal(guard.isProcessed(key1), true);
  assert.equal(guard.isProcessed(key2), true);

  // Wait 35ms more (total t=75ms). key1 should expire (75 > 60), key2 should still be valid (35 < 60)
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(guard.isProcessed(key1), false, 'Key1 must have expired');
  assert.equal(guard.isProcessed(key2), true, 'Key2 must still be active within its TTL window');
});

test('IdempotencyGuard - High volume distinct event IDs isolation', () => {
  const guard = new IdempotencyGuard();
  const count = 200;

  for (let i = 0; i < count; i++) {
    const key = `evt_distinct_uuid_urn:uuid:${i}:store_shard_${i % 5}`;
    guard.markProcessed(key, { seq: i, hash: `sha256_${i * 31}` });
  }

  // Verify all 200 distinct keys are intact and correctly partitioned
  for (let i = 0; i < count; i++) {
    const key = `evt_distinct_uuid_urn:uuid:${i}:store_shard_${i % 5}`;
    assert.equal(guard.isProcessed(key), true);
    assert.equal(guard.getResponse(key)?.seq, i);
  }

  // Verify unrecorded key
  assert.equal(guard.isProcessed('evt_non_existent_key_9999'), false);
});

test('IdempotencyGuard - Edge cases: special characters, nullish responses, default TTL', () => {
  const defaultGuard = new IdempotencyGuard(); // Default 24hr TTL
  const specialKey = 'shopify://orders/2026/08/24?event=update&trace=a/b+c==';

  // Nullish response handling
  defaultGuard.markProcessed(specialKey, undefined);
  assert.equal(defaultGuard.isProcessed(specialKey), true);
  assert.equal(defaultGuard.getResponse(specialKey), undefined);

  // Overwriting with structured data
  defaultGuard.markProcessed(specialKey, { updated: true });
  assert.equal(defaultGuard.isProcessed(specialKey), true);
  assert.deepEqual(defaultGuard.getResponse(specialKey), { updated: true });
});

test('IdempotencyGuard - reserve() claims a key once and release() frees it', () => {
  const guard = new IdempotencyGuard();
  assert.equal(guard.reserve('evt_reserve_1', { status: 'IN_FLIGHT' }), true);
  assert.equal(guard.reserve('evt_reserve_1'), false, 'second claim must fail while in flight');
  assert.equal(guard.isProcessed('evt_reserve_1'), true);

  guard.release('evt_reserve_1');
  assert.equal(guard.isProcessed('evt_reserve_1'), false);
  assert.equal(guard.reserve('evt_reserve_1'), true, 'released key can be claimed again');
});
