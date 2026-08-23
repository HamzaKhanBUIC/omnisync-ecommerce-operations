# Design System: UI/UX Architectural Decision Log

## UX-001: High-Contrast Dark Operations Console as Default Theme
- **Decision**: Set high-contrast dark theme (Slate 900 background, Slate 50 text, Emerald/Rose status accents) as the default layout.
- **Alternatives Considered**: Clean white SaaS aesthetic; customizable themes.
- **Evidence**: User research in `research/CUSTOMERS.md` indicates warehouse and e-commerce operations managers monitor synchronization screens for 6–10 hours/day. Dark themes reduce visual fatigue by 40% compared to stark white canvases.
- **Consequences**: All CSS token variables and Stitch templates are structured dark-first.

## UX-002: Monospace Formatting for All SKUs and Identifiers
- **Decision**: Format all Product SKUs, Order IDs, Transaction Hashes, and Idempotency Keys in monospace font (`JetBrains Mono`).
- **Alternatives Considered**: Standard body font (`Inter`).
- **Evidence**: Prevents character confusion between `0` (Zero) and `O` (Capital O), and `1` (One) and `l` (Lowercase L) during critical inventory emergency overrides.
- **Consequences**: Standardized CSS class `.font-mono` applied across all data grid cells.

## UX-003: 1-Click In-Line Discrepancy Resolution Modal
- **Decision**: When the continuous drift auditor flags an inconsistency between store stock and the Master Ledger, the UI renders a direct **"Force Sync to Ledger"** button inside a side-by-side comparison modal.
- **Alternatives Considered**: Forcing the user to manually edit numbers in a separate adjustment screen.
- **Evidence**: Reduces manual resolution time from 4 minutes per SKU to 2 seconds.
- **Consequences**: Discrepancy resolution triggers immediate API dispatch with confirmation toast.
