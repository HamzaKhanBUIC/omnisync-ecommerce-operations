# Autonomous Factory Orchestration Specification (.agent/ORCHESTRATOR.md)

## 1. Mission Control & Operational Philosophy
The Orchestrator is the central meta-agent governing workflow progression, task decomposition, agent delegation, state persistence, and quality enforcement.
- **The Orchestrator does not write application code directly.**
- **The Orchestrator does not perform manual research directly.**
- **The Orchestrator delegates specialized work to specialist agents (.agents/agents/) using reusable skills (.agents/skills/).**
- **The Orchestrator never blindly trusts subagent outputs; it mandates objective verification.**

---

## 2. Master Phase Control Loop

The Factory operates across 5 discrete lifecycle phases:

```
[Phase 1: Research & Discovery]
  │ (Parallel Research Subagents)
  ▼
[Phase 2: Product Strategy & UX Design]
  │ (Product Strategist + Designer)
  ▼
[Phase 3: Architecture & System Engineering]
  │ (Architect + Backend + Frontend + Integration Engineers)
  ▼
[Phase 4: Verification, Security & Red Team Chaos]
  │ (QA + Security + Reliability + Red Team)
  ▼
[Phase 5: Release Authorization & Final Evaluation]
  │ (Final Evaluator)
  ▼
[Deployment & Live Operations]
```

### Phase Transition Quality Gate
Before transitioning between any phase, the Orchestrator MUST:
1. Verify that all required output artifacts for the active phase exist in their designated repository folders.
2. Confirm that all open questions or blockers in `.agent/OPEN_PROBLEMS.md` are resolved.
3. Validate that `.agent/DECISIONS.md` records all major architectural and product choices.
4. Update `.agent/STATE.md` with active status, completed deliverables, and next actions.
5. Commit a state checkpoint in `.agent/checkpoints/`.

---

## 3. Task Decomposition & Execution Models

The Orchestrator chooses between 5 distinct execution models depending on task dependencies and risk profiles:

### Model A: Sequential Execution
- **When to Use**: Linear dependent tasks where Step N+1 depends on Step N output (e.g., Architecture Design ➔ Schema Definition ➔ Repository Implementation).
- **Rule**: Verify intermediate artifact before initiating downstream task.

### Model B: Parallel Execution (Subagents)
- **When to Use**: Independent, read-heavy or multi-domain discovery (e.g., simultaneous research on Shopify APIs, WooCommerce HPOS, and Competitor Pricing).
- **Rule**: Spawn separate subagents with narrow context. Recombine structured findings into master research files.

### Model C: Fresh-Context Iteration
- **When to Use**: Long-running phases to prevent context rot and token saturation.
- **Rule**: Checkpoint current state into `.agent/HANDOFF.md` and `.agent/STATE.md`, spin up a clean context window, and resume directly from persistent artifacts.

### Model D: Isolated Worktrees
- **When to Use**: Concurrent code modifications across multiple frontend and backend packages.
- **Rule**: Use git worktree or isolated feature branches; merge only upon green test pass.

---

## 4. Evidence Requirements & Decision Recording

Every proposal, architecture choice, and product requirement must follow the **Empirical Decision Pipeline**:
```
HYPOTHESIS ──► EVIDENCE ──► CONFIDENCE SCORE ──► ALTERNATIVES CONSIDERED ──► DECISION ──► CONSEQUENCES
```
- Findings without evidence are classified as unverified assumptions in `.agent/ASSUMPTIONS.md`.
- Accepted decisions are permanently logged in `.agent/DECISIONS.md`.

---

## 5. Critique & Independent Red Team System
Every major milestone requires adversarial review:
- The **QA Engineer** and **Red Team** assume the implementation has edge-case flaws, rate-limit vulnerabilities, race conditions, or unhandled webhook drops.
- Critique output is delivered as prioritized findings: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

---

## 6. Repair Loop & Failure Recovery

### The Bounded Repair Cycle:
```
FINDING ──► PRIORITIZE ──► DIAGNOSE ROOT CAUSE ──► REPAIR IN ISOLATION ──► RETEST ──► REGRESSION CHECK ──► VERIFY RESOLUTION
```

### Bounded Retry Strategy:
- **Maximum Retries per Error**: 3 attempts.
- **On Failure Attempt 1 & 2**: Log failure, analyze stack trace/error code, modify strategy.
- **On Failure Attempt 3**: STOP. Escalate to `.agent/OPEN_PROBLEMS.md`, document blocked state, notify Lead Architect.

---

## 7. Context Management & Anti-Rot Strategy
1. Never pass large, uncurated raw API dumps or transcripts into main context.
2. Store full payloads in `testing/` or `research/` and pass structured 10-line executive summaries to the Orchestrator.
3. Keep `.agent/CURRENT_OBJECTIVE.md` under 50 lines to maintain absolute execution focus.
