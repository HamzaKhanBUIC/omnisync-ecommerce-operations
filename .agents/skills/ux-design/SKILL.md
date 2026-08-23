---
name: ux-design
description: Operational UX design methodology focusing on high information density, glanceable status pills, and zero-friction resolution.
---

# Skill: High-Density Operations UX Design (`ux-design`)

## 1. Clear Purpose & Overview
Defines ergonomics, component hierarchies, and visual patterns for mission-critical operations consoles.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 2 by ux-researcher and designer.

## 3. Required Inputs & Context
- product/USER_WORKFLOWS.md
- product/REQUIREMENTS.md

## 4. Step-by-Step Procedure
1. Establish information density rules (scannable data grids, compact row heights).
2. Define color-coded status badges (Emerald Synced, Amber Pending, Rose Drift/Error).
3. Map screen-by-screen navigation hierarchy (Dashboard, Ledger, Order Hub, Drift Modal).
4. Author design/UX.md and design/USER_FLOWS.md.

## 5. Expected Outputs & Deliverables
- design/UX.md
- design/DESIGN_SYSTEM.md
- design/USER_FLOWS.md
- design/DESIGN_DECISIONS.md

## 6. Quality Checks & Verification Gates
- [ ] High contrast accessibility verified (>4.5:1 ratio).
- [ ] Monospace font enforced for all IDs and SKUs.
- [ ] 1-click drift resolution action specified.

## 7. Failure Handling & Bounded Retry Runbook
Iterate on user workflows if screen transitions require more than 2 clicks to resolve an anomaly.
