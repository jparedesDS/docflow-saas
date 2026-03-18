# DocFlow

Herramienta interna de gestión documental para EIPSA. Single-tenant, sin router frontend.

## Stack

- **Backend**: FastAPI (Python 3.11+) — `docflow/backend/`
- **Frontend**: React 18 (CRA, sin react-router) — `docflow/frontend/src/`
- **Estilos**: Tailwind CSS 3 (`darkMode: 'class'`) + CSS vars en `index.css`
- **Iconos**: Phosphor Icons (`@phosphor-icons/react`) + Heroicons
- **Gráficas**: Recharts
- **Animaciones**: Framer Motion
- **HTTP client**: Axios (centralizado en `services/api.js`)
- **Auth**: JWT (python-jose + bcrypt). Usuarios en `backend/users.json`
- **Datos**: Excel (openpyxl/pandas) — no hay base de datos SQL

## Comandos

```bash
# Backend
cd docflow/backend
pip install -r ../../requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd docflow/frontend
npm install
npm start          # dev en :3000
npm run build      # producción
```

## Estructura del proyecto

```
docflow/
├── backend/
│   ├── main.py                    # FastAPI app + APScheduler (lifespan)
│   ├── routers/                   # Endpoints API (20 módulos)
│   ├── services/                  # Lógica de negocio (24 módulos)
│   │   └── parsers/               # Parsers de email (tr_parser, base_parser)
│   ├── models/                    # Pydantic models
│   ├── repositories/
│   │   └── instances.py           # Singletons: data_repo, consulta_repo, tags_repo
│   ├── utils/
│   │   ├── config.py              # USERS, constantes, env vars
│   │   ├── json_store.py          # read_json/write_json con file locking
│   │   ├── auth_middleware.py     # JWT middleware
│   │   └── logging_config.py     # structlog setup
│   └── users.json                 # Usuarios persistidos (bcrypt hashes)
├── frontend/src/
│   ├── App.js                     # Sidebar + routing por estado (activeSection)
│   ├── pages/                     # 24 páginas (incl. ProjectsHub, ReportsHub, WorkflowsHub)
│   ├── components/                # 15+ componentes reutilizables
│   ├── contexts/                  # ThemeContext, I18nContext, ToastContext, TenantContext
│   ├── constants/
│   │   └── status.js              # STATUS_COLORS (fuente única de colores)
│   ├── utils/
│   │   └── dates.js               # formatDate, timeAgo, diasDesde, etc.
│   ├── services/
│   │   └── api.js                 # Axios instance con baseURL + interceptors
│   └── translations/
│       └── index.js               # Diccionario ES/EN
```

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

### Paleta "Industrial Indigo"
- **Accent**: Light `#4F46E5`, Dark `#6366F1`
- **Roles**: Doc Controller `#4F46E5` (indigo), PM `#0D9488` (teal), Comercial `#D97706` (amber)
- **Font**: Inter (was Outfit)

### Colores dark mode
- Fondo: `#0C0D12`, Cards: `#151721`, Sidebar: `#0E1019`, Borders: `#2E3244`
- Acentos: indigo `#6366F1`, verde `#16A34A`, amber `#D97706`, rosa `#DB2777`, rojo `#DC2626`

## Convenciones backend

- **Router → Service**: Los routers no contienen lógica de negocio, solo validan y delegan a services.
- **ExcelRepository**: Singleton en `repositories/instances.py`. Nunca instanciar directamente, importar `data_repo`, `consulta_repo`, `tags_repo`.
- **JSON persistido**: Usar `json_store.read_json/write_json` (file locking + escritura atómica). No abrir archivos JSON manualmente.
- **Auth**: JWT via `auth_middleware.py`. Endpoints protegidos usan `Depends(get_current_user)`.
- **Config**: Constantes y usuarios en `utils/config.py`. Env vars en `.env`.
- **API prefix**: `/api/v1/`
- **Scheduled jobs**: APScheduler en `main.py` lifespan (backup diario, polling IMAP cada 15min, reclamaciones jueves, resumen semanal lunes, PDF mensual día 1).

## Datos Excel

- **data_erp.xlsx**: Datos maestros ERP. Columna `Repsonsable` (typo intencional) = responsable del documento.
- **consulta_erp.xlsx**: Consultas comerciales. `Responsable` = comercial del pedido (NO es el mismo campo).
- `Estado == ""` equivale a "sin enviar" → incluido en `ESTADOS_PENDIENTES`.

## Workflow de Claude Code

- **Planificación**: Usar skill `using-superpowers` para decidir qué workflow aplicar antes de implementar. Para tareas multi-step, usar `writing-plans` para crear el plan y `executing-plans` para ejecutarlo.
- **Documentación de librerías**: Usar MCP Context7 (`resolve-library-id` → `query-docs`) para consultar docs actualizadas de cualquier librería antes de generar código. No confiar en conocimiento de entrenamiento para APIs específicas.
- **Verificación**: Siempre usar `verification-before-completion` antes de declarar trabajo terminado.

## Idioma

Comunicación siempre en español. Código (variables, funciones) en inglés excepto nombres de dominio (`Reclamaciones`, `Pedido`, etc.).
