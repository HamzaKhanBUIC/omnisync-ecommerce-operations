# AI Product Factory — Autonomous Operating System (Master Charter)

## 1. System Topology & Three-Layer Separation

This project operates under strict three-layer autonomy:

```
AI Product Factory — Session 02 — E-commerce Operations/
├── AGENTS.md                                # Workspace Master Charter & Global Invariants
│
├── .agent/                                  # Layer 1: Autonomous Control Plane & State Authority
│   ├── ORCHESTRATOR.md                      # Control Loop, Delegation, Parallelism & Recovery
│   ├── STATE.md                             # Live Phase & Execution State
│   ├── DECISIONS.md                         # Permanent Architectural & Product Decisions Log
│   ├── ASSUMPTIONS.md                       # Core System Operating Assumptions & Confidence
│   ├── OPEN_PROBLEMS.md                     # Roadmap & Blockers Matrix
│   ├── CURRENT_OBJECTIVE.md                 # Active Execution Target
│   └── HANDOFF.md                           # Inter-Phase & Context Transition Contract
│
├── .agents/                                 # Layer 2 & 3: Specialists & Operational Skills
│   ├── agents/                              # Layer 2: 15 Specialist Agent Definitions
│   │   ├── researcher/agent.md
│   │   ├── competitor-analyst/agent.md
│   │   ├── customer-analyst/agent.md
│   │   ├── product-strategist/agent.md
│   │   ├── ux-researcher/agent.md
│   │   ├── designer/agent.md
│   │   ├── architect/agent.md
│   │   ├── integration-engineer/agent.md
│   │   ├── backend-engineer/agent.md
│   │   ├── frontend-engineer/agent.md
│   │   ├── qa-engineer/agent.md
│   │   ├── security-reviewer/agent.md
│   │   ├── reliability-reviewer/agent.md
│   │   ├── red-team/agent.md
│   │   └── final-evaluator/agent.md
│   │
│   └── skills/                              # Layer 3: 14 Reusable Execution Skills
│       ├── research/SKILL.md
│       ├── competitive-analysis/SKILL.md
│       ├── problem-validation/SKILL.md
│       ├── product-definition/SKILL.md
│       ├── ux-design/SKILL.md
│       ├── stitch-design/SKILL.md
│       ├── implementation/SKILL.md
│       ├── testing/SKILL.md
│       ├── browser-testing/SKILL.md
│       ├── debugging/SKILL.md
│       ├── security-review/SKILL.md
│       ├── red-team/SKILL.md
│       ├── repair/SKILL.md
│       └── final-evaluation/SKILL.md
│
├── research/                                # Session Evidence Base (Market, Customer, Competitors)
├── product/                                 # Product Specification (PRD, ICP, User Workflows)
├── design/                                  # UI/UX Design System, Tokens, & Screen Flows
├── architecture/                            # Distributed Topology, Data Models, Security Specs
├── testing/                                 # Test Plans, Security Reports, Chaos Benchmarks
│
├── src/                                     # Runnable Implementation
├── tests/                                   # Automated Test Suites
├── docs/                                    # Developer Guides, MCP Strategy, Runbooks
└── scripts/                                 # Utility & Simulation CLIs
```

## 2. Invariants & Autonomous Rules of Engagement

1. **State Centrality**: No specialist agent may mutate state without recording the rationale in `.agent/DECISIONS.md` and updating `.agent/STATE.md`.
2. **Evidence Over Opinion**: Assertions must be substantiated by empirical data, documentation links, API responses, or test results in `research/`, `product/`, or `testing/`.
3. **No Unisolated Write Collisions**: Implementation agents must never concurrently modify the same source files without worktree isolation.
4. **Zero Unverified Code**: No task is marked complete until verified by automated tests or browser automation.
5. **Deterministic Security Boundary**: Raw API keys and secrets must never be committed in plain text. HMAC signatures must always use constant-time comparison.
