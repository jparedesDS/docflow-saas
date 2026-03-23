# DocFlow

SaaS multi-tenant de gestión documental (EIPSA → multi-organización). Aislamiento row-level por `tenant_id`.

## Stack

- **Backend**: FastAPI (Python 3.11+) — `docflow/backend/`
- **Frontend**: React 18 (CRA, sin react-router) — `docflow/frontend/src/`
- **Base de datos**: PostgreSQL 16 (SQLAlchemy 2.0 + Alembic) — fallback a Excel via `STORAGE_BACKEND`
- **Estilos**: Tailwind CSS 3 (`darkMode: 'class'`) + CSS vars en `index.css`
- **Iconos**: Phosphor Icons + Heroicons | **Gráficas**: Recharts | **Animaciones**: Framer Motion
- **HTTP**: Axios centralizado en `services/api.js`
- **Auth**: JWT (python-jose + bcrypt), payload: `{sub, role, initials, tenant_id, exp}`
- **Billing**: Stripe (checkout, portal, webhooks)
- **Infra**: Docker Compose (PostgreSQL, Redis, backend, frontend)

## Comandos

```bash
# Backend
cd docflow/backend
pip install -r ../../requirements.txt
uvicorn main:app --reload --port 8000                                    # modo Excel
STORAGE_BACKEND=postgres DATABASE_URL=postgresql://... uvicorn main:app   # modo PostgreSQL
alembic upgrade head                                                      # migraciones
python scripts/import_excel.py                                            # Excel → Postgres

# Frontend
cd docflow/frontend && npm install && npm start    # dev :3000
npm run build                                       # producción

# Docker
docker compose up -d                                                      # desarrollo
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d     # producción
```

## Decisiones de arquitectura

### Multi-Tenancy
- Row-level: `tenant_id` FK en las 17 tablas ORM
- `STORAGE_BACKEND=excel` (default, singletons) | `postgres` (JSONB + filtro automático por tenant)
- Planes: `free` (3 users, 500 docs) · `pro` (15 users, 10K docs) · `enterprise` (ilimitado)

### Navegación (v3.0)
- Sin react-router. `App.js` maneja `activeSection` (sidebar) + lazy-load de páginas
- Cada hub gestiona tabs internos con `TabBar.js`. Breadcrumbs via `onTabChange`
- Agenda y Notificaciones: paneles laterales desde topbar

### Repository Pattern
- `BaseRepository` → `ExcelRepository` (pandas + TTL 60s) | `PostgresRepository` (JSONB + tenant_id)
- Código nuevo: `Depends(get_data_repo)` de `repositories/factory.py`
- Código existente: `instances.py` (auto-switch por env var)

## Convenciones

### Frontend
- **Status colors**: Siempre usar exports de `constants/status.js`. NUNCA hardcodear colores de estado
- **HTTP**: `api.get/post` de `services/api.js`. Cero `fetch()` directo
- **Fechas**: Funciones de `utils/dates.js`. No formatear inline
- **Toasts**: `useToast()` → `showToast(msg, type, duration)`
- **Tema**: CSS vars (`--bg-page`, `--bg-card`, `--border`, `--text-main`). Dark mode via class `dark`
- **i18n**: `useI18n()` → `t('key')`. Keys en `translations/index.js`
- **Iconos**: Phosphor (`weight="thin"` empty states, `weight="bold"` acciones)
- **Feature flags**: `useTenant().hasFeature('name')` para condicionar UI

### Backend
- **Router → Service**: Routers solo validan y delegan. Lógica en services
- **JSON I/O**: `json_store.read_json/write_json` (file locking + escritura atómica). NUNCA abrir JSON manualmente
- **Auth**: `Depends(get_current_user)` de `auth_middleware.py`. Payload incluye `tenant_id`
- **API prefix**: `/api/v1/`
- **Tenant-aware**: Todo servicio que acceda datos DEBE filtrar por `tenant_id`
- **Jobs**: APScheduler en `main.py` lifespan (backup 2AM, IMAP cada 15min, claims jueves, resumen lunes, PDF día 1)

### Paleta "Industrial Indigo"
- Accent: Light `#4F46E5` · Dark `#6366F1`
- Roles: Doc Controller `#4F46E5` · PM `#0D9488` · Comercial `#D97706`
- Dark mode: bg `#0C0D12` · cards `#151721` · sidebar `#0E1019` · borders `#2E3244`
- Font: Inter

## Gotchas

- `data_erp.xlsx` columna `Repsonsable` (typo intencional) = responsable del documento
- `consulta_erp.xlsx` columna `Responsable` = comercial del pedido (NO es el mismo campo)
- `Estado == ""` equivale a "sin enviar" → incluido en `ESTADOS_PENDIENTES`
- PostgreSQL: Documents/Consultas/Tags en JSONB preservan nombres de columna exactos del Excel

## Workflow de Claude Code — OBLIGATORIO

### 1. Planificación y subagentes (REQUERIDO antes de implementar)

IMPORTANTE: Antes de escribir código de implementación, DEBES seguir este proceso:

1. **Evaluar**: Usar skill `using-superpowers` para decidir el workflow correcto
2. **Planificar**: Para tareas multi-step, usar `writing-plans` → crear plan detallado
3. **Ejecutar con subagentes**: Usar `executing-plans` para ejecutar el plan con checkpoints
4. **Paralelizar**: Cuando haya 2+ tareas independientes, usar `dispatching-parallel-agents` para lanzar subagentes en paralelo
5. **Aislar**: Lanzar subagentes con `isolation: "worktree"` para trabajo que necesite aislamiento del workspace principal

Flujo de decisión:
- Tarea simple (1 archivo, cambio directo) → implementar directamente
- Tarea media (2-5 archivos relacionados) → `writing-plans` → implementar
- Tarea compleja (6+ archivos, múltiples dominios) → `writing-plans` → `dispatching-parallel-agents` con worktrees
- Feature completa → `using-superpowers` → plan → subagentes paralelos → `verification-before-completion`

### 2. Documentación de librerías — MCP Context7 (REQUERIDO)

NUNCA confiar en conocimiento de entrenamiento para APIs específicas. SIEMPRE usar Context7:

1. `resolve-library-id` con el nombre de la librería y la pregunta
2. Elegir el mejor match (preferir IDs exactos y version-specific)
3. `query-docs` con el ID seleccionado y la pregunta
4. Responder usando los docs obtenidos — incluir ejemplos y citar versión

Aplica para: React, FastAPI, SQLAlchemy, Tailwind, Stripe, Framer Motion, Recharts, Phosphor, y cualquier otra dependencia.

### 3. Verificación (REQUERIDO antes de declarar trabajo terminado)

Usar skill `verification-before-completion` SIEMPRE antes de:
- Declarar que el trabajo está completo
- Hacer commit o crear PR
- Afirmar que tests pasan o bugs están arreglados

Evidencia antes de afirmaciones. Ejecutar comandos de verificación y confirmar output.

## Idioma

Comunicación siempre en español. Código (variables, funciones) en inglés excepto nombres de dominio (`Reclamaciones`, `Pedido`, etc.).
