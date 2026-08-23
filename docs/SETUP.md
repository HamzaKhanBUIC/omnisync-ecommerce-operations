# Developer Setup & Local Environment Guide (docs/SETUP.md)

## 1. Prerequisites
- **Node.js**: `>= 20.x` (Tested and validated on Node.js v24.15.0 with native `--experimental-strip-types`).
- **Python**: `>= 3.11` (For simulation benchmarks and reconciliation utilities).
- **Docker & Docker Compose**: (For local PostgreSQL 16 and Redis 7 services).
- **Git**: For version control.

---

## 2. Quick-Start Commands

```bash
# 1. Clone repository
git clone https://github.com/org/ecommerce-operations.git
cd ecommerce-operations

# 2. Run automated test suites (Ledger, HMAC, Rate Limiting, Concurrency Flash Sale)
node --experimental-strip-types --test tests/unit/ledger.test.ts tests/unit/hmac.test.ts tests/unit/ratelimit.test.ts tests/simulations/concurrency.test.ts

# 3. Run high-volume flash sale traffic simulator
python scripts/simulation/traffic_simulator.py

# 4. Run live channel drift auditor and automated self-healing utility
python scripts/reconciliation/drift_checker.py
```
