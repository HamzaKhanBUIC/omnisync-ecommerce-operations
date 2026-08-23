# Core System Operating Assumptions (.agent/ASSUMPTIONS.md)

| Assumption ID | Assumption Description | Underlying Reason | Confidence Score | Validation Status |
|---|---|---|---|---|
| **ASM-001** | External webhooks are delivered at least once with potential duplication and out-of-order arrival. | Standard distributed webhook architecture of Shopify and WooCommerce. | **HIGH (99%)** | Validated via `IdempotencyGuard` sliding cache. |
| **ASM-002** | Local Node.js v24 environment supports native ES module execution and type stripping. | Verified via `node --experimental-strip-types` execution in test suites. | **HIGH (100%)** | Verified and passing. |
| **ASM-003** | Google Drive filesystem may lock rapid parallel file writes in `node_modules`. | Google Drive cloud sync hooks lock file descriptors during burst writes. | **HIGH (95%)** | Mitigated by using native zero-dependency test runner. |
| **ASM-004** | WooCommerce stores may run either HPOS or legacy postmeta storage engines. | Merchant ecosystem heterogeneity across WordPress hosting providers. | **MEDIUM (80%)** | Adapter will support both with HPOS optimization default. |
| **ASM-005** | Stitch MCP is available for automated UI design system generation and visual tokens. | Stitch MCP tools registered in Antigravity environment. | **HIGH (90%)** | Documented in `docs/MCP_STRATEGY.md`. |
