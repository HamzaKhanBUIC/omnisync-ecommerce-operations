# Design System: Tokens, Typography & Component Standards

## 1. Color System
```css
:root {
  /* Surface & Background */
  --bg-primary: #0F172A;      /* Slate 900 - Dark Operations Room Default */
  --bg-secondary: #1E293B;    /* Slate 800 - Component Cards */
  --bg-elevated: #334155;     /* Slate 700 - Hover / Table Headers */
  --border-subtle: #475569;   /* Slate 600 - Dividers */
  
  /* Typography */
  --text-primary: #F8FAFC;    /* Slate 50 - High Contrast Text */
  --text-secondary: #94A3B8;  /* Slate 400 - Secondary Labels */
  --text-muted: #64748B;      /* Slate 500 - Timestamps */
  
  /* Status Colors */
  --status-emerald: #10B981;  /* Emerald 500 - Synced / Healthy */
  --status-emerald-bg: #064E3B; /* Emerald 900 */
  --status-amber: #F59E0B;    /* Amber 500 - Throttled / Retrying */
  --status-amber-bg: #78350F;   /* Amber 900 */
  --status-rose: #EF4444;     /* Rose 500 - Drift / Error */
  --status-rose-bg: #881337;    /* Rose 900 */
  --status-cyan: #06B6D4;     /* Cyan 500 - Active Webhook Inbound */
}
```

## 2. Typography Hierarchy
- **Interface Font**: `Inter`, `-apple-system`, `sans-serif` (Weights: 400, 500, 600, 700).
- **Data & Monospace Font**: `JetBrains Mono`, `Fira Code`, `monospace` (Weights: 400, 500).
- **Scale**:
  - Heading 1: `20px / 28px` (Semi-bold)
  - Heading 2: `16px / 24px` (Semi-bold)
  - Body Text: `13px / 18px` (Regular)
  - Monospace Data: `12px / 16px` (Medium)
  - Micro Badges: `10px / 14px` (Bold uppercase)

## 3. Core UI Components
1. `<MetricCard label="" value="" subtext="" trend="" />`
2. `<StatusPill status="HEALTHY | WARNING | ERROR" label="" />`
3. `<VirtualizedLedgerTable data={skus} onAdjustStock={...} />`
4. `<DiscrepancyModal isOpen={bool} item={sku} onResolve={...} />`
5. `<EventStreamTerminal events={liveCloudEvents} />`
