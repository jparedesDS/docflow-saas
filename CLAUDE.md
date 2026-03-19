# DocFlow

SaaS multi-tenant de gestión documental. Originalmente herramienta interna de EIPSA, ahora soporta múltiples organizaciones con aislamiento de datos row-level.

## Stack

- **Backend**: FastAPI (Python 3.11+) — `docflow/backend/`
- **Frontend**: React 18 (CRA, sin react-router) — `docflow/frontend/src/`
- **Base de datos**: PostgreSQL 16 (SQLAlchemy 2.0 + Alembic) — fallback a Excel via `STORAGE_BACKEND`
- **Estilos**: Tailwind CSS 3 (`darkMode: 'class'`) + CSS vars en `index.css`
- **Iconos**: Phosphor Icons (`@phosphor-icons/react`) + Heroicons
- **Gráficas**: Recharts
- **Animaciones**: Framer Motion
- **HTTP client**: Axios (centralizado en `services/api.js`)
- **Auth**: JWT (python-jose + bcrypt) con `tenant_id` en payload
- **Billing**: Stripe (checkout, portal, webhooks)
- **Infra**: Docker Compose (PostgreSQL, Redis, backend, frontend)

## Comandos

```bash
# Backend (modo Excel — original)
cd docflow/backend
pip install -r ../../requirements.txt
uvicorn main:app --reload --port 8000

# Backend (modo PostgreSQL)
STORAGE_BACKEND=postgres DATABASE_URL=postgresql://... uvicorn main:app --reload

# Migraciones
cd docflow/backend
alembic upgrade head

# Import Excel → PostgreSQL
cd docflow/backend
python scripts/import_excel.py

# Frontend
cd docflow/frontend
npm install
npm start          # dev en :3000
npm run build      # producción

# Docker (desarrollo)
docker compose up -d

# Docker (producción)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Estructura del proyecto

```
docflow/
├── backend/
│   ├── main.py                    # FastAPI app + APScheduler + middleware stack
│   ├── db/
│   │   ├── database.py            # SQLAlchemy engine + get_db() dependency
│   │   └── models.py              # ORM models (17 tablas, todas con tenant_id)
│   ├── alembic/                   # Migraciones PostgreSQL
│   ├── routers/                   # Endpoints API (23 módulos)
│   │   ├── auth.py                # Login, refresh, /me, /users (JSON o Postgres)
│   │   ├── tenants.py             # Registro, invitaciones, settings
│   │   ├── billing.py             # Stripe checkout, portal, webhooks, usage
│   │   └── admin.py               # Superadmin: listar/editar tenants, impersonar
│   ├── services/                  # Lógica de negocio (28 módulos)
│   │   ├── tenant_service.py      # Registro, invitaciones, settings per-tenant
│   │   ├── plan_service.py        # Planes (free/pro/enterprise), feature flags, quotas
│   │   ├── billing_service.py     # Stripe customer, subscriptions, webhooks
│   │   ├── usage_service.py       # Contadores mensuales por tenant
│   │   └── parsers/               # Parsers de email
│   ├── repositories/
│   │   ├── base_repository.py     # Interfaz abstracta
│   │   ├── excel_repository.py    # Implementación Excel (TTL cache 60s)
│   │   ├── postgres_repository.py # Implementación PostgreSQL (JSONB + tenant_id)
│   │   ├── instances.py           # Singletons (switch STORAGE_BACKEND)
│   │   └── factory.py             # FastAPI dependencies per-request
│   ├── scripts/
│   │   └── import_excel.py        # Migración Excel → PostgreSQL
│   ├── models/                    # Pydantic models
│   └── utils/
│       ├── config.py              # USERS, constantes, env vars
│       ├── json_store.py          # read_json/write_json con file locking
│       ├── auth_middleware.py     # JWT dependencies (tenant_id incluido)
│       ├── rate_limit.py          # Rate limiting por IP + por tenant/plan
│       └── logging_config.py     # structlog setup
├── frontend/src/
│   ├── App.js                     # Sidebar + routing + registro
│   ├── pages/
│   │   ├── Register.js            # Formulario de registro de organización
│   │   ├── Onboarding.js          # Wizard post-registro
│   │   ├── AdminDashboard.js      # Panel superadmin (gestión de tenants)
│   │   └── ...                    # 24+ páginas de la app
│   ├── components/
│   │   └── LoginScreen.js         # Login con selector de usuarios + email + "Crear cuenta"
│   ├── contexts/
│   │   ├── TenantContext.js       # Fetch real de /tenants/me + feature flags
│   │   └── ...
│   └── services/
│       └── api.js                 # Axios con JWT + X-Tenant-Id header
```

## Multi-Tenancy

**Arquitectura**: Row-level tenancy — `tenant_id` en cada tabla.

**Switch de storage** via `STORAGE_BACKEND`:
- `excel` (default): Comportamiento original, ExcelRepository singletons
- `postgres`: PostgresRepository con filtro automático por tenant_id

**Tablas principales**: `tenants`, `users`, `documents` (JSONB), `consultas` (JSONB), `tags_inspections` (JSONB), `agenda_items`, `claims_log`, `notifications`, `email_templates`, `scheduled_reports`, `processed_emails`, `invitations`, `tenant_settings`, `billing_info`, `usage_records`

**Planes**:
- `free`: 3 users, 500 docs, features limitados
- `pro`: 15 users, 10K docs, todas las features
- `enterprise`: ilimitado

**JWT payload**: `{sub, role, initials, tenant_id, exp}`

## Arquitectura de navegación (v3.0)

No hay react-router. `App.js` maneja `activeSection` (sidebar) y cada hub maneja sus tabs internos con `TabBar.js`.

| Sidebar          | Hub/Página          | Tabs internos                                      |
|------------------|---------------------|---------------------------------------------------|
| Inicio           | Dashboard.js        | — (funnel, activity, team workload, quick access)  |
| Proyectos        | ProjectsHub.js      | Vista General, Seguimiento, Urgencias              |
| Documentos       | DocumentsHub.js     | Registro, Tablero (kanban 4 cols)                  |
| Comunicaciones   | Communications.js   | Bandeja, Transmittals, Reclamaciones, Firmas       |
| Informes         | ReportsHub.js       | Resumen, Rendimiento, Equipo, Centro de Reportes   |
| ERP              | ErpHub.js           | Consulta, Tags & Inspecciones                      |
| Flujos de trabajo| WorkflowsHub.js     | Automatizaciones, Aprobaciones (placeholder)       |
| Configuración    | Settings.js         | Cuenta, Equipo, Plantillas, Integraciones, Sistema, Actividad, Facturación |

- Agenda → panel lateral desde topbar (icono calendario)
- Notificaciones → panel lateral desde bell icon "Ver todas"
- Breadcrumbs multi-nivel: `Sección > Tab` via `onTabChange` callback.

## Convenciones frontend

- **Colores de estado**: Siempre usar exports de `constants/status.js` (STATUS_COLORS, DASHBOARD_COLORS, DOCUSIGN_STATUS_COLORS, etc.). Nunca hardcodear colores de estado.
- **StatusBadge**: Componente único para badges de estado en toda la app.
- **HTTP**: Usar `api.get/post` de `services/api.js`. Cero `fetch()` directo.
- **Fechas**: Usar funciones de `utils/dates.js`. No formatear fechas inline.
- **Toasts**: `useToast()` de `contexts/ToastContext.js` → `showToast(msg, type, duration)`.
- **Tema**: CSS vars (`--bg-page`, `--bg-card`, `--border`, `--text-main`). Dark mode via class `dark`.
- **i18n**: `useI18n()` → `t('key')`. Keys en `translations/index.js`.
- **Iconos**: Preferir Phosphor (`weight="thin"` para empty states, `weight="bold"` para acciones).
- **Feature flags**: `useTenant().hasFeature('feature_name')` para condicionar UI.

### Paleta "Industrial Indigo"
- **Accent**: Light `#4F46E5`, Dark `#6366F1`
- **Roles**: Doc Controller `#4F46E5` (indigo), PM `#0D9488` (teal), Comercial `#D97706` (amber)
- **Font**: Inter (was Outfit)

### Colores dark mode
- Fondo: `#0C0D12`, Cards: `#151721`, Sidebar: `#0E1019`, Borders: `#2E3244`
- Acentos: indigo `#6366F1`, verde `#16A34A`, amber `#D97706`, rosa `#DB2777`, rojo `#DC2626`

## Convenciones backend

- **Router → Service**: Los routers no contienen lógica de negocio, solo validan y delegan a services.
- **Repository**: Para nuevo código, usar `Depends(get_data_repo)` de `repositories/factory.py`. Para código existente, `instances.py` sigue funcionando (auto-switch por `STORAGE_BACKEND`).
- **JSON persistido**: Usar `json_store.read_json/write_json` (file locking + escritura atómica). No abrir archivos JSON manualmente.
- **Auth**: JWT via `auth_middleware.py`. Endpoints protegidos usan `Depends(get_current_user)`. Payload incluye `tenant_id`.
- **Config**: Constantes y usuarios en `utils/config.py`. Env vars en `.env`.
- **API prefix**: `/api/v1/`
- **Tenant-aware services**: Todos los servicios que acceden datos deben filtrar por `tenant_id`.
- **Scheduled jobs**: APScheduler en `main.py` lifespan (backup diario, polling IMAP cada 15min, reclamaciones jueves, resumen semanal lunes, PDF mensual día 1).

## Datos

**Modo Excel** (STORAGE_BACKEND=excel):
- **data_erp.xlsx**: Datos maestros ERP. Columna `Repsonsable` (typo intencional) = responsable del documento.
- **consulta_erp.xlsx**: Consultas comerciales. `Responsable` = comercial del pedido (NO es el mismo campo).
- `Estado == ""` equivale a "sin enviar" → incluido en `ESTADOS_PENDIENTES`.

**Modo PostgreSQL** (STORAGE_BACKEND=postgres):
- Documents/Consultas/Tags almacenados como JSONB — preserva nombres de columna exactos del Excel.
- Datos estructurados (users, agenda, claims, etc.) en tablas con columnas tipadas.

## Workflow de Claude Code

- **Planificación**: Usar skill `using-superpowers` para decidir qué workflow aplicar antes de implementar. Para tareas multi-step, usar `writing-plans` para crear el plan y `executing-plans` para ejecutarlo.
- **Documentación de librerías**: Usar MCP Context7 (`resolve-library-id` → `query-docs`) para consultar docs actualizadas de cualquier librería antes de generar código. No confiar en conocimiento de entrenamiento para APIs específicas.
- **Verificación**: Siempre usar `verification-before-completion` antes de declarar trabajo terminado.

## Idioma

Comunicación siempre en español. Código (variables, funciones) en inglés excepto nombres de dominio (`Reclamaciones`, `Pedido`, etc.).
