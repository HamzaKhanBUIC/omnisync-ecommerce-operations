# Autonomous Control & State System (.agent/)

## 1. Architectural Distinction
This repository separates autonomous multi-agent engineering into **Three Distinct Layers**:

`
┌─────────────────────────────────────────────────────────────────────────┐
│                           1. .agent/                                    │
│       The Project\'s Autonomous Control Plane & State Authority         │
│   (state.json, session memory, control loop, checkpoints, task queue)  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Orchestrates & Coordinates
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           2. .agents/                                   │
│            Specialist Agent Roles, Personas & Decision Rules            │
│   (researcher, architect, backend-engineer, red-team, evaluator, etc.)  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Invokes
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           3. .skills/                                   │
│            Deterministic Reusable Operational Procedures & Tools         │
│   (research, competitive-analysis, testing, browser-testing, repair)    │
└─────────────────────────────────────────────────────────────────────────┘
`

## 2. Control Loop Dynamics
The .agent/ control plane operates in a continuous state-action-verification loop:
1. **Observe**: Read state.json and active workspace state.
2. **Orient**: Resolve current phase, dependencies, and active locks.
3. **Decide**: Delegate task to target specialist agent defined in .agents/<role>/.
4. **Act**: Specialist agent executes using reusable procedural skills in .skills/<skill>/.
5. **Verify**: Run automated verification tests (	ests/, 	esting/).
6. **Checkpoint**: Persist ledger state and progress in .agent/checkpoints/ and update .agent/state.json.

## 3. State Management Rules
- All state transitions in .agent/state.json must be atomic and audit-logged.
- Specialist agents in .agents/ NEVER bypass the control plane or mutate state arbitrarily.
- Every skill in .skills/ is stateless, idempotent, and executed on behalf of an active specialist agent.
