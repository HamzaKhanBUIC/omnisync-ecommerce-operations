---
name: debugging
description: Structured methodology for diagnosing queue failures, sync bottlenecks, unhandled webhook payloads, and delta mismatches.
---

# Skill: Distributed Trace & Ledger Debugging (`debugging`)

## 1. Clear Purpose & Overview
Provides a rigorous 5-step diagnostic procedure for resolving runtime anomalies without introducing regressions.

## 2. When to Use (Trigger Criteria)
Triggered whenever an error, test failure, or unexpected state occurs.

## 3. Required Inputs & Context
- Error stack trace
- Failed payload / transaction ID
- Relevant source files

## 4. Step-by-Step Procedure
1. Reproduce the error in an isolated minimal unit test fixture.
2. Inspect raw inputs, transaction deltas, and state before/after the failure point.
3. Identify the root cause (e.g. race condition, floating point inaccuracy, timing mismatch).
4. Formulate a surgical fix preserving all existing invariants.
5. Verify fix with the minimal test, then run full regression suite.

## 5. Expected Outputs & Deliverables
- Root cause analysis
- Surgical patch in src/
- Regression test in tests/

## 6. Quality Checks & Verification Gates
- [ ] Root cause proven with reproducing test.
- [ ] All regression tests pass.

## 7. Failure Handling & Bounded Retry Runbook
If root cause cannot be determined after 2 attempts, log detailed diagnostic trace in .agent/OPEN_PROBLEMS.md.
