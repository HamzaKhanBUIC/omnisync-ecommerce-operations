---
name: final-evaluation
description: Formal release verification checklist ensuring all functional requirements, security gates, and SLOs are satisfied.
---

# Skill: Quality Gate & Release Verification (`final-evaluation`)

## 1. Clear Purpose & Overview
Authorizes phase transitions and production releases based on objective verification evidence.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 5 by final-evaluator.

## 3. Required Inputs & Context
- product/ACCEPTANCE_CRITERIA.md
- testing/TEST_RESULTS.md
- testing/RED_TEAM_REPORT.md
- testing/RECONCILIATION_REPORT.md

## 4. Step-by-Step Procedure
1. Verify all items in product/ACCEPTANCE_CRITERIA.md are satisfied with empirical proof.
2. Verify all test suites in tests/ pass with 0 failures.
3. Verify security audit in testing/RED_TEAM_REPORT.md shows zero unresolved vulnerabilities.
4. Generate factory setup / release sign-off report in docs/.

## 5. Expected Outputs & Deliverables
- docs/FACTORY_SETUP_REPORT.md
- Updated .agent/STATE.md

## 6. Quality Checks & Verification Gates
- [ ] Zero unverified checklist items.
- [ ] 100% agreement across all test reports.

## 7. Failure Handling & Bounded Retry Runbook
If any acceptance criterion is unmet, reject release, revert STATE.md to active phase, and delegate remediation to responsible specialist.
