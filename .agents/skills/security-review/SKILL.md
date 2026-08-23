---
name: security-review
description: Security audit procedure verifying cryptographic signatures, secret encryption, tenant isolation, and input sanitization.
---

# Skill: Application Security Audit & Review (`security-review`)

## 1. Clear Purpose & Overview
Audits application code against OWASP Top 10, timing attack vulnerabilities, and secret leakage risks.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 4 by security-reviewer.

## 3. Required Inputs & Context
- src/shared/hmac.ts
- src/integrations/
- architecture/SECURITY.md

## 4. Step-by-Step Procedure
1. Inspect webhook signature verification for constant-time comparisons (`crypto.timingSafeEqual`).
2. Audit secrets management: ensure API keys are encrypted at rest using AES-256-GCM and never logged in plain text.
3. Verify tenant isolation in database queries.
4. Document findings in testing/RED_TEAM_REPORT.md.

## 5. Expected Outputs & Deliverables
- testing/RED_TEAM_REPORT.md (Security Section)

## 6. Quality Checks & Verification Gates
- [ ] Zero plain text secrets in logs.
- [ ] Timing safe HMAC validation 100% verified.

## 7. Failure Handling & Bounded Retry Runbook
Any security vulnerability is treated as a P0 blocker; halt release authorization until patched and verified.
