---
name: product-definition
description: Standardized procedure for authoring PRDs, user stories, acceptance criteria, and non-goals.
---

# Skill: Product Requirements & Scope Authoring (`product-definition`)

## 1. Clear Purpose & Overview
Transforms verified research into crisp, unambiguous engineering specifications and MVP boundaries.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 2 by product-strategist.

## 3. Required Inputs & Context
- All files in research/

## 4. Step-by-Step Procedure
1. Define the Ideal Customer Profile (ICP) and qualification criteria.
2. Establish MVP boundaries (Core in-scope vs deferred Phase 2 capabilities).
3. Map end-to-end user workflows (Channel connection, order sync, drift repair).
4. Author formal functional and non-functional requirements with verifiable acceptance criteria.

## 5. Expected Outputs & Deliverables
- product/PRD.md
- product/ICP.md
- product/MVP_DECISION.md
- product/USER_WORKFLOWS.md
- product/REQUIREMENTS.md
- product/ACCEPTANCE_CRITERIA.md
- product/NON_GOALS.md

## 6. Quality Checks & Verification Gates
- [ ] Every requirement has an ID (FR-x / NFR-x).
- [ ] Acceptance criteria are binary verifiable (Pass/Fail).
- [ ] Non-goals explicitly prevent scope creep.

## 7. Failure Handling & Bounded Retry Runbook
If requirements conflict with technical limits from research/, adjust scope and log decision in .agent/DECISIONS.md.
