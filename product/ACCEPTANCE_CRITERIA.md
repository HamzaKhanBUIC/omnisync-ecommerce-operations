# Product Definition: Binary Acceptance Criteria

- [ ] **AC-1 (Signature Verification)**: 100% of incoming webhooks with tampered or missing signatures are rejected with HTTP 401.
- [ ] **AC-2 (Idempotency Replay)**: Sending the identical order webhook 50 times results in exactly 1 ledger transaction and 0 duplicate stock deductions.
- [ ] **AC-3 (Zero Overselling Guarantee)**: Under 30 simultaneous checkout webhooks competing for 5 stock units, exactly 5 succeed, 25 are rejected, and final master stock equals 0.
- [ ] **AC-4 (Sub-Second Latency)**: End-to-end webhook-to-channel sync latency benchmarks achieve p50 < 300ms and p95 < 800ms.
- [ ] **AC-5 (Rate-Limit Immunity)**: Under a burst simulation of 5,000 requests, zero HTTP 429 rate limit errors are generated.
- [ ] **AC-6 (Automated Drift Healing)**: Injected drift on an external store is detected and auto-repaired to Master Ledger truth within 1 reconciliation cycle.
- [ ] **AC-7 (Audit Trail Completeness)**: 100% of stock changes generate an immutable ledger entry with origin store, reference ID, and delta.
- [ ] **AC-8 (Dashboard UI Usability)**: Operational dashboard renders real-time KPI metrics, color-coded health pills, and functional discrepancy resolution modal.
