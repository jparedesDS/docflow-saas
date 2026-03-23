# DocFlow Roadmap EIPSA — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Each feature is an independent workstream — dispatch parallel agents with `isolation: "worktree"`.

**Goal:** Implementar 15 features priorizadas por impacto real para el equipo EIPSA, desde P0 (fricción diaria) hasta P3 (nice to have).

**Architecture:** Cada feature es independiente y se implementa como backend service + router + frontend page/component. Se apoya en servicios existentes (monitoring, analytics, claims, transmittals). Multi-tenant aware (tenant_id en todo).

**Tech Stack:** FastAPI, React 18, Tailwind CSS, Framer Motion, Recharts, Phosphor Icons, SQLAlchemy 2.0

---

## Execution Strategy

6 workstreams paralelos (worktrees aislados):

| Workstream | Features | Agent |
|------------|----------|-------|
| WS-1 | #1 Actualización masiva transmittals | Agent A |
| WS-2 | #2 Bandeja "Mi Mañana" | Agent B |
| WS-3 | #3 Dashboard carga equipo + #6 Anomalías cliente | Agent C |
| WS-4 | #4 Reclamaciones escalado + #7 Tendencias KPIs | Agent D |
| WS-5 | #5 Búsqueda global Ctrl+K | Agent E |
| WS-6 | #8 Predicción mejorada + #9 Timeline doc | Agent F |

Features P2/P3 restantes (#10-#15) se planifican después de completar P0+P1.

---

## Feature Plans (detailed below)

See individual plan files:
- `2026-03-23-f01-bulk-status-update.md`
- `2026-03-23-f02-mi-manana.md`
- `2026-03-23-f03-team-workload.md`
- `2026-03-23-f04-claims-escalation.md`
- `2026-03-23-f05-global-search.md`
- `2026-03-23-f06-anomaly-detection.md`
- `2026-03-23-f07-kpi-trends.md`
- `2026-03-23-f08-prediction-improved.md`
- `2026-03-23-f09-doc-timeline.md`
