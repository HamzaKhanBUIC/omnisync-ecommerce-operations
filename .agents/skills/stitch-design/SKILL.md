---
name: stitch-design
description: Integrates Stitch MCP design tools to generate visual tokens, components, and layout templates.
---

# Skill: Stitch Design Framework Integration (`stitch-design`)

## 1. Clear Purpose & Overview
Produces standardized design system tokens and component manifests utilizing Stitch MCP capabilities.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 2 by designer.

## 3. Required Inputs & Context
- design/UX.md
- design/DESIGN_SYSTEM.md

## 4. Step-by-Step Procedure
1. Initialize Stitch design system configuration via `call_mcp_tool` (StitchMCP: create_design_system).
2. Upload design markdown tokens and layout rules.
3. Generate screen variants and components for Inventory Ledger and Drift Resolution.
4. Persist manifests in design/STITCH/.

## 5. Expected Outputs & Deliverables
- design/STITCH/manifest.json
- design/STITCH/components/

## 6. Quality Checks & Verification Gates
- [ ] Design tokens match 4px baseline grid.
- [ ] All status colors exported as CSS variables.

## 7. Failure Handling & Bounded Retry Runbook
If Stitch MCP is unavailable, fallback to native CSS/Tailwind design tokens in design/DESIGN_SYSTEM.md.
