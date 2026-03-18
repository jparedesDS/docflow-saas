# DocFlow Industrial

API y servicios para gestión de documentación industrial: transmittals, emails (GAIA, Aconex, Docspace, etc.), integración ERP, notificaciones y reportes.

## Estructura del proyecto

```
DocFlow/
├── docflow/
│   ├── backend/          # API FastAPI
│   │   ├── models/       # Modelos de datos
│   │   ├── routers/      # Endpoints (documents, emails, erp, claims, ai, reports, notifications, transmittals)
│   │   ├── services/     # Lógica de negocio y parsers de email
│   │   └── repositories/ # Acceso a datos (Excel, Postgres)
│   └── frontend/         # Frontend de la aplicación
├── requirements.txt
├── setup.bat             # Configuración inicial Windows
└── INDEX.md              # Índice de documentación (diagnóstico GAIA TNEF, etc.)
```

## Requisitos

- Python 3.10+
- Dependencias: ver `requirements.txt` y `docflow/backend/requirements.txt`

## Instalación rápida

1. Clonar el repositorio y entrar en la carpeta:
   ```bash
   cd DocFlow
   ```

2. Crear entorno virtual e instalar dependencias:
   ```bash
   python -m venv docflow_env
   docflow_env\Scripts\activate
   pip install -r requirements.txt
   pip install -r docflow/backend/requirements.txt
   ```

   En Windows también puedes usar `setup.bat` si está configurado.

3. Configurar variables de entorno:
   - Copiar `docflow/backend/.env.example` a `docflow/backend/.env`
   - Rellenar IMAP/SMTP, API keys, etc. (nunca subas `.env` a Git)

4. Ejecutar la API:
   ```bash
   cd docflow/backend
   uvicorn main:app --reload
   ```

   La API quedará en `http://localhost:8000`. Documentación interactiva en `/docs`.

## Documentación adicional

- **[INDEX.md](./INDEX.md)** – Índice de toda la documentación (diagnóstico GAIA TNEF, arquitectura, checklist).
- **[QUICK_START.txt](./QUICK_START.txt)** – Inicio rápido para el soporte de emails GAIA con TNEF.
- **README_GAIA_DIAGNOSTICO.md**, **SOLUCION_GAIA_TNEF.md**, **ARQUITECTURA_GAIA.txt** – Detalles técnicos y solución del problema TNEF.

## Licencia

Repositorio público. Ver el repositorio en GitHub para más detalles.
