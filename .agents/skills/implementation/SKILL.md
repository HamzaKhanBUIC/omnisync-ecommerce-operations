---
name: implementation
description: Standardized best-practice procedure for writing clean, type-safe, testable backend, adapter, and frontend code.
---

# Skill: Clean & Resilient Code Implementation (`implementation`)

## 1. Clear Purpose & Overview
Guides developers in implementing code following strict architectural invariants, idempotency, and error handling.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 3 by backend-engineer, integration-engineer, and frontend-engineer.

## 3. Required Inputs & Context
- architecture/ARCHITECTURE.md
- architecture/DATA_MODEL.md
- architecture/INTEGRATIONS.md

## 4. Step-by-Step Procedure
1. Define TypeScript models and shared schemas in src/shared/types.ts.
2. Implement cryptographic HMAC validation in src/shared/hmac.ts using crypto.timingSafeEqual.
3. Implement leaky bucket rate limiting in src/shared/rateLimiter.ts.
4. Implement thread-safe Master Ledger Engine with atomic deltas in src/backend/ledgerEngine.ts.
5. Implement channel adapters and operations orchestrator in src/integrations/ and src/workflows/.

## 5. Expected Outputs & Deliverables
- src/shared/
- src/backend/
- src/integrations/
- src/workflows/
- src/index.ts

## 6. Quality Checks & Verification Gates
- [ ] No absolute stock overwrites from webhooks.
- [ ] All mutations pass through ledger with audit trail.
- [ ] TypeScript compiles with 0 errors.

## 7. Failure Handling & Bounded Retry Runbook
Run isolated unit tests. If logic fails, debug using distributed trace analysis before touching master ledger state.
