---
name: repair
description: Automated runbook for resolving inventory drift, flushing corrupted queues, and self-healing store mismatches.
---

# Skill: Automated Drift Reconciliation & Self-Healing (`repair`)

## 1. Clear Purpose & Overview
Provides deterministic procedures for detecting and auto-repairing stock discrepancies between channels and the Master Ledger.

## 2. When to Use (Trigger Criteria)
Triggered continuously by the background drift auditor and during manual discrepancy resolution.

## 3. Required Inputs & Context
- Active channel store API connections
- Master Ledger inventory records

## 4. Step-by-Step Procedure
1. Poll external channel store APIs for current SKU stock counts.
2. Compare channel counts against Master Ledger current stock.
3. If drift is detected: compute delta adjustment and broadcast Master Ledger truth to the drifted channel.
4. Log repair event with timestamp and SKU ID in audit trail.

## 5. Expected Outputs & Deliverables
- testing/RECONCILIATION_REPORT.md
- Audit log records

## 6. Quality Checks & Verification Gates
- [ ] 100% of detected drift repaired within 1 reconciliation cycle.
- [ ] All repairs recorded in ledger audit trail.

## 7. Failure Handling & Bounded Retry Runbook
If channel API returns 5xx during repair, queue job in DLQ with exponential backoff and alert operations dashboard.
