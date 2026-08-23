---
name: red-team
description: Adversarial chaos engineering procedure executing race condition attacks, burst floods, and webhook tamper attacks.
---

# Skill: Adversarial Chaos & Concurrency Testing (`red-team`)

## 1. Clear Purpose & Overview
Subject the system to extreme adversarial stress to prove zero overselling and zero ghost inventory.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 4 by red-team specialist.

## 3. Required Inputs & Context
- src/workflows/orchestrator.ts
- src/backend/ledgerEngine.ts

## 4. Step-by-Step Procedure
1. Execute 30-100 simultaneous concurrent checkout webhooks competing for 5 limited edition stock units.
2. Inject tampered HMAC payloads and verify immediate rejection with HTTP 401.
3. Inject replayed webhook payloads 50 times in 1 second and verify idempotency rejection.
4. Document results in testing/RED_TEAM_REPORT.md.

## 5. Expected Outputs & Deliverables
- tests/simulations/concurrency.test.ts
- testing/RED_TEAM_REPORT.md

## 6. Quality Checks & Verification Gates
- [ ] Exactly available stock fulfilled, 100% of excess rejected.
- [ ] Final ledger stock equals exactly 0 (no negative balances).

## 7. Failure Handling & Bounded Retry Runbook
If any oversell occurs, escalate immediately to backend-engineer to refine mutex locking / database row locks.
