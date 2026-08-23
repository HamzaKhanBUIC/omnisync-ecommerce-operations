---
name: browser-testing
description: Execution of browser automation via Chrome DevTools MCP or Playwright for UI validation.
---

# Skill: Browser Automation & UI Testing (`browser-testing`)

## 1. Clear Purpose & Overview
Validates frontend dashboard interactions, data table virtual scrolling, and drift resolution modal workflows in a real browser.

## 2. When to Use (Trigger Criteria)
Triggered during Phase 4 by qa-engineer and frontend-engineer.

## 3. Required Inputs & Context
- Frontend dev server URL
- Target UI workflow scenarios

## 4. Step-by-Step Procedure
1. Launch headless/interactive browser session via chrome-devtools-mcp.
2. Navigate to dashboard and inspect console messages and network requests.
3. Simulate user actions: filtering SKUs, clicking 'Force Sync', opening audit modal.
4. Take screenshots and verify zero layout shifts or console errors.

## 5. Expected Outputs & Deliverables
- testing/BROWSER_TEST_REPORT.md
- UI screenshots in testing/

## 6. Quality Checks & Verification Gates
- [ ] Zero uncaught console errors.
- [ ] DOM render latency <200ms.
- [ ] Modal interaction completes successfully.

## 7. Failure Handling & Bounded Retry Runbook
Capture heap snapshot and DOM snapshot to inspect broken selectors or unhandled promise rejections.
