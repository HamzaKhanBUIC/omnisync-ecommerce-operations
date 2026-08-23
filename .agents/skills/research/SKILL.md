---
name: research
description: Structured procedural skill for conducting empirical market and technical API research with citations.
---

# Skill: Ecosystem & Technical API Research (`research`)

## 1. Clear Purpose & Overview
Provides a rigorous, repeatable method for researching ecommerce platforms, API schemas, rate limits, and technical constraints.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 1 by researcher, customer-analyst, or integration-engineer when investigating external platforms.

## 3. Required Inputs & Context
- Research question or topic
- Target API / platform endpoints
- Search keywords

## 4. Step-by-Step Procedure
1. Formulate specific technical inquiry (e.g., Shopify GraphQL inventory mutation rate limits).
2. Query official documentation via web search / read_url_content.
3. Extract exact parameter types, HTTP headers, error codes, and concurrency constraints.
4. Synthesize findings into structured markdown with direct source citations in research/.

## 5. Expected Outputs & Deliverables
- Structured research markdown files with citations in research/

## 6. Quality Checks & Verification Gates
- [ ] All API limits cited from official docs.
- [ ] Payload examples must be valid JSON/GraphQL.
- [ ] No unverified assumptions.

## 7. Failure Handling & Bounded Retry Runbook
If official docs are ambiguous, search developer changelogs or RFC discussions. If still unconfirmed, record in .agent/ASSUMPTIONS.md with MEDIUM confidence.
