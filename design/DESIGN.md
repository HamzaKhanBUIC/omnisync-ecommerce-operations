# OmniSync Design System & Component Specification (DESIGN.md)

## 1. Design Philosophy: Tactical Precision & Commerce Authority

OmniSync is engineered for high-concurrency multi-channel e-commerce operations. The visual language is **Obsidian Precision**, combining the minimalism and keyboard agility of Linear with the transactional rigor of Stripe's financial infrastructure.

### Core Principles
1. **Content-First Telemetry**: Every pixel, badge, and border serves real operational visibility. Zero decorative fluff.
2. **Tabular Numerics & Zero Layout Shift**: JetBrains Mono with tabular figures (`font-variant-numeric: tabular-nums`) ensures metrics never jump or vibrate during live 60 FPS SSE ingestion.
3. **Tactile Physicality**: Subtle 1px translucent borders with top-edge specular highlight bevels (`inset 0 1px 0 rgba(255, 255, 255, 0.08)`) create tangible depth without heavy muddy drop shadows.
4. **4px/8px Geometric Baseline**: All paddings, margins, line heights, and element heights snap strictly to multiples of 4px.

---

## 2. Color System & Semantic Tokens

### Surface Hierarchy
| Token | Hex / Value | Purpose |
| :--- | :--- | :--- |
| `surface-canvas` | `#08090D` | Base application canvas and background void |
| `surface-sidebar` | `#0C0E14` | Navigation rail with 1px right specular divider |
| `surface-panel` | `#11141E` | Primary cards, table panels, and container wells |
| `surface-elevated` | `#161A28` | Hover states, modals, and slide-over inspector drawer |
| `surface-hover` | `#1C2132` | Interactive row highlights and dropdown menus |
| `surface-well` | `#090B10` | Input fields, code blocks, and recessed status areas |

### Border Tokens
- `border-faint`: `rgba(255, 255, 255, 0.04)`
- `border-subtle`: `rgba(255, 255, 255, 0.075)`
- `border-medium`: `rgba(255, 255, 255, 0.13)`
- `border-strong`: `rgba(255, 255, 255, 0.22)`
- `border-active`: `rgba(16, 185, 129, 0.4)`

### Semantic Accents
- **Emerald (Healthy / Parity / Sync)**: `#10B981` (Glow: `rgba(16, 185, 129, 0.22)`)
- **Cyan (Telemetry / Velocity / CloudEvents)**: `#38BDF8` (Glow: `rgba(56, 189, 248, 0.25)`)
- **Indigo (Apparel / Routing / Navigation)**: `#818CF8`
- **Amber (Low Stock / Rate Limit Warning)**: `#FBBF24`
- **Rose (Oversell Block / Dead-Letter / Critical Drift)**: `#F43F5E`

---

## 3. Typography & Optical Hierarchy

### Font Families
- **Interface Sans**: `Inter`, `Plus Jakarta Sans`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`
- **Telemetry Monospace**: `JetBrains Mono`, `Fira Code`, `ui-monospace`, `monospace`

### Scale & Rhythms
- **Display Metric**: `28px / 34px` — Bold (800), `letter-spacing: -0.035em`, Tabular Figures
- **Section Heading**: `16px / 22px` — SemiBold (700), `letter-spacing: -0.02em`
- **Panel Title**: `14px / 20px` — SemiBold (600), `letter-spacing: -0.015em`
- **Body / Cell**: `12.5px / 18px` — Regular (400) / Medium (500)
- **Monospace Chip / SKU**: `11.5px / 16px` — SemiBold (600)
- **Micro Label / Caps**: `10px / 14px` — Bold (700), `letter-spacing: 0.08em`, Uppercase

---

## 4. Component Primitives

### 1. KPI Metric Card
- 18px padding, 13px border radius (`--radius-lg`).
- 1px top highlight bevel.
- Status badge on top right with glowing dot.
- Large tabular figure with trend subtitle.

### 2. Virtualized Data Table
- Sticky header with 11px uppercase monospace titles.
- Row height: 48px with smooth hover background (`rgba(255, 255, 255, 0.025)`).
- Status chips with glowing dot indicators.
- Quick action buttons with 1-click modal / drawer inspection triggers.

### 3. Real-Time Canvas Velocity Chart
- 60 FPS cubic Bézier spline interpolation.
- Dual translucent gradient fills for Inbound Webhooks vs Outbound Broadcasts.
- Background gridlines at 35px intervals.

### 4. Proactive Rate Budget Meters
- 7px pill-shaped progress track with inner shadow.
- Leaky bucket refill animation with color-coded safety thresholds.

### 5. Slide-Over Inspector Drawer & Command Palette
- 560px width, backdrop blur 12px.
- Tabbed layout: Overview, Allocations, Line Items, JSON Payload.
- Global `Cmd+K` / `Ctrl+K` keyboard spotlight.
