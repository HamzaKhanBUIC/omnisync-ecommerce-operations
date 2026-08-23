# Phase 3 Architecture: Failure Recovery & Dead-Letter Queues (DLQ)

## 1. Bounded Exponential Backoff with Full Jitter
- When transient errors occur (HTTP 429, 502, 503, 504):
  ```typescript
  function calculateBackoff(attempt: number): number {
    const baseMs = 200;
    const maxMs = 5000;
    const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
    return Math.floor(Math.random() * exponential); // Full jitter
  }
  ```
- Maximum retry attempts: **3 retries**.

## 2. Dead Letter Queue (DLQ) Routing
- Jobs failing after 3 retries are moved to Redis `DLQ:sync_failures`.
- Surfaced in operational dashboard with failure timestamp, error payload, and 1-click **"Replay Job"** button.
