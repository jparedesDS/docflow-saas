# Checklist de Implementación - Soporte GAIA TNEF

**Creado**: 2026-03-04
**Estado**: Listo para implementar
**Tiempo Estimado**: 30 minutos
**Dificultad**: ⭐ Fácil (copy-paste)

---

## FASE 1: DIAGNÓSTICO (5 min)

- [ ] Abrir terminal en Windows
- [ ] Navegar a carpeta:
  ```bash
  cd U:\USUARIOS\jose.paredes\Desktop\DocFlow\docflow\backend
  ```
- [ ] Ejecutar script:
  ```bash
  python test_gaia_tnef.py
  ```
- [ ] Ver output y **GUARDAR en archivo**:
  ```bash
  python test_gaia_tnef.py > diagnostico_gaia.txt
  ```
- [ ] Abrir `diagnostico_gaia.txt` y revisar:
  - [ ] ¿Hay emails GAIA? (buscar "gaia" o "technip" en From)
  - [ ] ¿Tienen TNEF? (buscar "TNEF encontrado")
  - [ ] ¿Qué tipo de contenido?
    - [ ] htmlbody > 0 bytes → **Escenario A (Ideal)**
    - [ ] rtfbody > 0 bytes → **Escenario B (Necesita striprtf)**
    - [ ] body > 0 bytes → **Escenario C (Fallback)**
    - [ ] Ninguno → **Escenario D (Error)**
- [ ] Documentar resultado:
  ```
  Escenario encontrado: [A/B/C/D]
  htmlbody size: ___ bytes
  rtfbody size: ___ bytes
  body size: ___ bytes
  ```

---

## FASE 2: LECTURA DE DOCUMENTACIÓN (15 min)

- [ ] Leer `RESUMEN_EJECUTIVO.txt` (5 min)
- [ ] Leer `README_GAIA_DIAGNOSTICO.md` (5 min)
- [ ] Leer `ARQUITECTURA_GAIA.txt` (3 min)
- [ ] Leer `SOLUCION_GAIA_TNEF.md` sección "FIX #1" (2 min)

**Preguntas de comprensión:**
- [ ] ¿Por qué GAIA usa TNEF? (Microsoft/Outlook)
- [ ] ¿Dónde está el problema? (línea 99 de imap_service.py)
- [ ] ¿Cuál es la solución? (try/except + fallback)
- [ ] ¿Necesito striprtf? (solo si Escenario B)

---

## FASE 3: PREPARAR CAMBIO (5 min)

### 3.1 Abrir archivo principal
- [ ] Abrir: `docflow/backend/services/imap_service.py`
- [ ] Ir a línea 82 (función `get_html_body`)
- [ ] Ver que termina en línea 105

### 3.2 Copiar código nuevo
- [ ] Abrir: `SOLUCION_GAIA_TNEF.md`
- [ ] Sección: "FIX #1: Mejorar get_html_body() en imap_service.py"
- [ ] Subsección: "Código Nuevo (PROPUESTO)"
- [ ] Seleccionar TODO el código Python (desde `def get_html_body` hasta fin)
- [ ] Copiar al clipboard

### 3.3 Hacer backup
- [ ] Hacer copia de `imap_service.py`:
  ```bash
  copy imap_service.py imap_service.py.backup
  ```

---

## FASE 4: IMPLEMENTAR CAMBIO (5 min)

### 4.1 Reemplazar función
- [ ] En `imap_service.py`, línea 82-105
- [ ] **Seleccionar TODO** desde `def get_html_body(msg):` hasta `return ""`
- [ ] **Borrar** el código seleccionado
- [ ] **Pegar** el código nuevo del clipboard
- [ ] **Verificar indentación** (debe empezar en columna 0, como antes)

### 4.2 Validar cambio
- [ ] Abrir `imap_service.py` y verificar:
  - [ ] Línea 82: `def get_html_body(msg):`
  - [ ] Dentro hay `try:` para TNEF
  - [ ] Hay `logger.debug()` y `logger.error()`
  - [ ] Hay fallback a rtfbody
  - [ ] Hay fallback a body
  - [ ] Cierra con `return ""`
- [ ] Sin errores de sintaxis (Python debería abrir sin errores)
- [ ] Guardar archivo: **Ctrl+S**

### 4.3 Verificar imports
- [ ] Verificar línea 6: `from tnefparse import TNEF` (debe estar)
- [ ] Verificar línea 9: `import logging` (debe estar)
  - Si NO está, agregar:
    ```python
    import logging
    ```
  - Y después de los otros imports:
    ```python
    logger = logging.getLogger(__name__)
    ```

---

## FASE 5: INSTALAR DEPENDENCIAS (1 min)

**SOLO si Escenario B fue detectado (rtfbody > 0)**

- [ ] Abrir terminal
- [ ] Si existe virtual environment activo, continuar
- [ ] Si no, activarlo:
  ```bash
  U:\USUARIOS\jose.paredes\Desktop\DocFlow\docflow_env\Scripts\activate
  ```
- [ ] Instalar striprtf:
  ```bash
  pip install striprtf
  ```
- [ ] Verificar instalación:
  ```bash
  python -c "from striprtf.striprtf import rtf_to_text; print('OK')"
  ```
- [ ] Debe mostrar: `OK`
- [ ] Desactivar venv (opcional):
  ```bash
  deactivate
  ```

---

## FASE 6: REINICIAR BACKEND (1 min)

### 6.1 Detener backend actual
- [ ] Ir a terminal donde corre FastAPI
- [ ] Presionar: **Ctrl+C**
- [ ] Esperar a que se detenga (puede tomar 2-3 segundos)

### 6.2 Iniciar backend nuevamente
- [ ] En misma terminal:
  ```bash
  python -m uvicorn main:app --reload
  ```
- [ ] Esperar a que muestre:
  ```
  Uvicorn running on http://127.0.0.1:8000
  ```
- [ ] Backend listo

### 6.3 Verificar en logs
- [ ] En terminal de FastAPI debe haber:
  ```
  INFO:     Started server process
  INFO:     Waiting for application startup
  INFO:     Application startup complete
  ```
- [ ] Sin errores de syntax (Python no debería reportar errores)

---

## FASE 7: TESTING (5 min)

### 7.1 Verificar que TR/ACONEX/SENDOC aún funcionan
- [ ] Abrir UI: `http://localhost:3000` (o donde esté frontend)
- [ ] Ir a "Email Assistants"
- [ ] Buscar email TR (Técnicas Reunidas)
- [ ] Hacer click en "Preview"
- [ ] [ ] Debe mostrar tabla con documentos ✓
- [ ] [ ] En logs debe haber: `"HTML directo encontrado en part text/html"`

### 7.2 Probar GAIA si existen emails
- [ ] En "Email Assistants", buscar email GAIA
  - Si no hay, ir a sección 7.4
- [ ] Hacer click en "Preview"
- [ ] [ ] Debe mostrar tabla ✓
- [ ] [ ] En logs debe haber:
  - `"TNEF encontrado"`
  - `"TNEF htmlbody encontrado"` O
  - `"RTF convertido a HTML"` O
  - `"Body plano convertido a HTML"`

### 7.3 Intentar enviar notificación
- [ ] Si preview funcionó, clickear "Send Notification"
- [ ] Verificar:
  - [ ] Correo enviado a dirección configurada
  - [ ] Tabla visible en el correo

### 7.4 Si NO hay emails GAIA en INBOX
- [ ] No es problema, el código está listo
- [ ] Para futuras pruebas, los emails GAIA funcionarán
- [ ] Verificar en logs que no haya errores de importación:
  ```bash
  grep -i "error" <logs_file>
  ```

---

## FASE 8: VERIFICACIÓN FINAL (2 min)

### 8.1 Logs check
- [ ] En terminal de FastAPI, revisar últimas líneas
- [ ] [ ] Sin errores de syntax
- [ ] [ ] Sin excepciones no capturadas
- [ ] [ ] Ver "TNEF" en logs (significa que intentó decodificar)

### 8.2 Rollback check
- [ ] Si algo falló:
  ```bash
  copy imap_service.py.backup imap_service.py
  ```
- [ ] Reiniciar FastAPI
- [ ] Reportar problema

### 8.3 Cleanup
- [ ] Opcional: Borrar archivo backup
  ```bash
  del imap_service.py.backup
  ```

---

## FASE 9: DOCUMENTACIÓN (2 min)

- [ ] Crear documento `IMPLEMENTACION_LOG.md` con:
  ```markdown
  # Implementación GAIA TNEF Support

  **Fecha**: 2026-03-04
  **Responsable**: [Tu nombre]
  **Estado**: Completo

  ## Diagnóstico
  - Escenario encontrado: B (rtfbody)
  - htmlbody: 0 bytes
  - rtfbody: 5234 bytes
  - body: 0 bytes

  ## Cambios
  - Archivo: docflow/backend/services/imap_service.py
  - Función: get_html_body() (línea 82-105)
  - Cambio: Agregado try/except, fallback, logging

  ## Dependencias Instaladas
  - striprtf 0.0.26

  ## Testing
  - ✓ TR emails funcionan
  - ✓ ACONEX emails funcionan
  - ✓ SENDOC emails funcionan
  - ✓ GAIA emails funcionan

  ## Resultado Final
  - Email GAIA preview: EXITOSO
  - Email GAIA envío: EXITOSO
  - Logs: Claros y útiles para debugging
  ```

---

## TROUBLESHOOTING

### Problema: "ModuleNotFoundError: No module named 'striprtf'"
**Solución**:
```bash
pip install striprtf
# Reiniciar FastAPI
```

### Problema: "IndentationError" en imap_service.py
**Solución**:
- La indentación se dañó al pegar
- Usar backup: `copy imap_service.py.backup imap_service.py`
- Intentar nuevamente con cuidado en indentación

### Problema: Email GAIA aún muestra error
**Solución**:
- Abrir logs en FastAPI
- Buscar línea con el UID del email
- Debe haber error específico
- Reportar error

### Problema: Preview funciona pero tabla vacía
**Solución**:
- La tabla HTML está vacía (TNEF correctamente decodificado)
- Problema en gaia_parser.py, no en imap_service.py
- Revisar que tabla tenga columna "Reference"

### Problema: TR/ACONEX/SENDOC ahora fallan
**Solución**:
- Rollback: `copy imap_service.py.backup imap_service.py`
- Revisar que no haya errores de lógica en código nuevo
- Usar versión anterior de imap_service.py

---

## TEMPO FINAL

| Fase | Tiempo | Cumplido |
|------|--------|----------|
| 1. Diagnóstico | 5 min | [ ] |
| 2. Lectura | 15 min | [ ] |
| 3. Preparar | 5 min | [ ] |
| 4. Implementar | 5 min | [ ] |
| 5. Dependencias | 1 min | [ ] |
| 6. Reiniciar | 1 min | [ ] |
| 7. Testing | 5 min | [ ] |
| 8. Verificación | 2 min | [ ] |
| 9. Documentación | 2 min | [ ] |
| **TOTAL** | **41 min** | |

---

## SIGN-OFF

- [ ] Implementación completada
- [ ] Todos los tests pasados
- [ ] Logs revisados sin errores
- [ ] Documentación actualizada
- [ ] Listo para producción

**Fecha de implementación**: ___________
**Responsable**: ___________
**Revisado por**: ___________

---

## REFERENCIAS

- Diagnóstico: `DIAGNOSTICO_GAIA_TNEF.md`
- Solución: `SOLUCION_GAIA_TNEF.md`
- Rápida: `README_GAIA_DIAGNOSTICO.md`
- Ejecutivo: `RESUMEN_EJECUTIVO.txt`
- Arquitectura: `ARQUITECTURA_GAIA.txt`
- Código: `docflow/backend/services/imap_service.py`

---

**Última revisión**: 2026-03-04
**Estado**: Listo para usar
