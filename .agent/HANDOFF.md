# Inter-Phase & Context Transition Contract (.agent/HANDOFF.md)

## 1. Quick-Start for Fresh-Context Agents
If you are waking up with a clean context window, follow this exact sequence:
1. Read `AGENTS.md` (Master Invariants) and `.agent/STATE.md` (Current Phase & Next Actions).
2. Read `.agent/CURRENT_OBJECTIVE.md` (Immediate Target).
3. Read `.agent/DECISIONS.md` and `.agent/ASSUMPTIONS.md` (Immutable Constraints).
4. Review upstream artifacts in `research/`, `product/`, `design/`, `architecture/`, or `testing/`.
5. DO NOT re-read entire raw transcripts. Proceed directly to executing the current objective.

---

## 2. Phase Transition Checklist
Every phase transition MUST satisfy:
- [ ] All required artifacts for current phase created and passing schema checks.
- [ ] No unresolved `CRITICAL` or `HIGH` blockers in `.agent/OPEN_PROBLEMS.md`.
- [ ] Verification tests passing 100% in `tests/`.
- [ ] Checkpoint serialized into `.agent/checkpoints/chk_<timestamp>.json`.
- [ ] `.agent/STATE.md` updated with completed deliverables and next phase objective.
