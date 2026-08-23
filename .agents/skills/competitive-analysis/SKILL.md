---
name: competitive-analysis
description: Methodology for benchmarking competitive SaaS tools, pricing tiers, architectural limitations, and market gaps.
---

# Skill: Competitive Intelligence & Feature Benchmarking (`competitive-analysis`)

## 1. Clear Purpose & Overview
Systematically dissects competitor solutions (Cin7, Katana, Linnworks, Pipe17) to uncover bottlenecks and product wedge opportunities.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 1 by competitor-analyst.

## 3. Required Inputs & Context
- List of target competitors
- Feature evaluation criteria (sync latency, rate limit handling, multi-store support)

## 4. Step-by-Step Procedure
1. Gather feature specs, pricing tiers, and API integration methods for each competitor.
2. Analyze merchant reviews and complaint logs regarding sync failures and overselling.
3. Construct a comparative matrix highlighting strengths, weaknesses, and architectural flaws.
4. Author research/COMPETITORS.md.

## 5. Expected Outputs & Deliverables
- research/COMPETITORS.md with structured comparison table

## 6. Quality Checks & Verification Gates
- [ ] At least 4 major competitors benchmarked.
- [ ] Specific failure modes documented.
- [ ] Clear market opportunity identified.

## 7. Failure Handling & Bounded Retry Runbook
If competitor specs are behind paywalls, inspect public documentation, community forums, and app store reviews.
