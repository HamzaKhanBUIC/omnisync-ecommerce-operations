# MCP Server Strategy & Permission Hierarchy (docs/MCP_STRATEGY.md)

## 1. Overview
Antigravity connects to MCP servers to extend agent capabilities with external tooling. To maintain maximum autonomy while preserving security boundaries, MCP servers are scoped strictly by phase and required tool permissions.

---

## 2. MCP Server Evaluation & Phased Permission Matrix

| MCP Server | Primary Purpose | Required Lifecycle Phase | Key Tools Used | Permission Level | Autonomy Boundary |
|---|---|---|---|---|---|
| **StitchMCP** | UI Design System generation, screen layout variants, visual token management | Phase 2 (Design) & Phase 3 (Frontend) | `create_design_system`, `generate_screen_from_text`, `upload_design_md`, `apply_design_system` | **Autonomous** | Restricted to `design/STITCH/` and frontend component manifests. |
| **chrome-devtools-mcp** | Headless and interactive browser automation, console error inspection, visual verification | Phase 4 (QA & Browser Testing) | `navigate_page`, `click`, `fill`, `take_screenshot`, `list_console_messages`, `evaluate_script` | **Autonomous** | Restricted to local development server (`http://localhost:*`). |
| **local-memory** | Persistent knowledge graph tracking across long-running sessions | Phase 1 through Phase 5 | `create_entities`, `create_relations`, `read_graph`, `search_nodes` | **Autonomous** | Reads/writes to local memory cache; no external network transmission. |
| **sequential-thinking** | Deep algorithmic reasoning for ledger conflict resolution and race condition modeling | Phase 3 (Architecture) & Phase 4 (Red Team) | `sequentialthinking` | **Autonomous** | In-memory reasoning step generation; zero side-effects. |
| **cloudrun** | Staging and production container deployments | Phase 5 (Release & Operations) | `deploy_local_folder`, `get_service_log`, `list_services` | **Human-Gated** | Requires explicit Lead Architect confirmation before deployment. |
| **firebase-mcp-server** | Firestore / Realtime DB backing (if enabled) | Phase 3 / 5 | `firestore_get_document`, `firestore_query_collection` | **Human-Gated** | Restricted by project authentication rules. |
| **dart-mcp-server** | Flutter tooling (Not required for Node/TS web stack) | Disabled / Inactive | `analyze_files`, `run_tests` | **Disabled** | Kept dormant; not needed for web-based ecommerce operations. |
| **gmp-code-assist** | Google Maps Platform assistance (Not required for core ledger) | Disabled / Inactive | `retrieve-google-maps-platform-docs` | **Disabled** | Kept dormant for core inventory engine. |

---

## 3. Security & Autonomy Guardrails
1. **Zero Human Intervention for Routine Operations**: Agents autonomously read project files, write code, execute tests, run local development commands, and perform browser audits.
2. **Strict Gate on Secrets & Host Destruction**: Agents must never delete system directories, expose API keys, or deploy to production without explicit human review.
