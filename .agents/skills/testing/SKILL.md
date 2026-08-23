---
name: testing
description: Standard procedure for running unit, integration, and concurrency test suites with automated verification.
---

# Skill: Comprehensive Test Suite Execution (`testing`)

## 1. Clear Purpose & Overview
Ensures all code changes are verified against regression, ledger invariant, and concurrency test suites.

## 2. When to Use (Trigger Criteria)
Triggered continuously across Phase 3 and Phase 4 by qa-engineer.

## 3. Required Inputs & Context
- src/
- tests/

## 4. Step-by-Step Procedure
1. Execute unit tests for ledger math, HMAC verifiers, and rate limiters.
2. Execute integration tests for channel adapters.
3. Execute concurrency simulations for flash sale traffic bursts.
4. Collect execution logs and coverage metrics into testing/TEST_RESULTS.md.

## 5. Expected Outputs & Deliverables
- testing/TEST_RESULTS.md
- Test execution console logs

## 6. Quality Checks & Verification Gates
- [ ] 100% test pass rate.
- [ ] Ledger invariant tests 100% green.
- [ ] Zero flakiness.

## 7. Failure Handling & Bounded Retry Runbook
On test failure, isolate failing assertion, diagnose root cause, invoke `repair` skill, and re-run full regression suite.
