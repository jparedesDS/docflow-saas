# DIAGNÓSTICO GAIA - Guía Rápida

## Qué se encontró

El código para parsear emails GAIA **existe pero está incompleto**. Los emails GAIA usan formato TNEF (propietario de Microsoft/Outlook) que requiere librería especial para decodificar.

**Estado actual:**
- ✓ Importación de `tnefparse` existe
- ✓ Código para decodificar TNEF existe
- ✗ Sin manejo de excepciones
- ✗ Sin fallback si TNEF no tiene htmlbody
- ✗ Sin logging para debuggear

**Resultado:** Emails GAIA lanzan excepciones cuando se intenta hacer preview.

---

## Archivos Creados para Diagnosticar

### 1. `diagnose_tnef.py`
Script que analiza estructura MIME **sin** necesidad de tnefparse.
Útil para ver qué tipo de contenido hay en los emails.

```bash
cd docflow/backend
python diagnose_tnef.py
```

**Output esperado:**
```
UID: 12345
From: support@gaia.technip.fr
Subject: [GAIA] Notification: 214726C-TEN-EIPSA...

  Part Content-Type: multipart/mixed
    [ℹ] TNEF encontrado
    Payload size: 45678 bytes
    First 50 bytes (hex): 1e00010b...
```

### 2. `test_gaia_tnef.py`
Script más completo que **SÍ usa tnefparse**.
Intenta decodificar TNEF y muestra estructura interna.

```bash
cd docflow/backend
python test_gaia_tnef.py
```

**Output esperado:**
```
[EMAIL #1] UID=12345
From: support@gaia.technip.fr
Subject: [GAIA] Notification: 214726C-TEN-EIPSA...

MIME Parts:
  [1] TNEF (size=45678 bytes)
        htmlbody: 5234 bytes
        rtfbody: 0 bytes
        body: 0 bytes
        attachments: 0
        htmlbody preview: '<html><body><table>...'...

RESUMEN:
  TNEF: SÍ (45678 bytes)
  HTML directo: NO
  Texto plano: NO
```

### 3. `run_diagnose.bat`
Archivo batch para ejecutar fácilmente en Windows.

```bash
run_diagnose.bat
```

---

## Qué Buscar en el Output

### Escenario 1: TNEF con htmlbody (IDEAL)
```
TNEF (size=XXX bytes)
  htmlbody: 5234 bytes    ← SI ES > 0
  rtfbody: 0 bytes
  body: 0 bytes
```
**Acción**: Aplicar FIX #1 simple (solo try/except)

### Escenario 2: TNEF con rtfbody (REQUIERE STRIP)
```
TNEF (size=XXX bytes)
  htmlbody: 0 bytes
  rtfbody: 8234 bytes     ← SI ES > 0
  body: 0 bytes
```
**Acción**: Aplicar FIX #1 + instalar `striprtf`

### Escenario 3: TNEF con body plano (FALLBACK)
```
TNEF (size=XXX bytes)
  htmlbody: 0 bytes
  rtfbody: 0 bytes
  body: 1234 bytes        ← SI ES > 0
```
**Acción**: Aplicar FIX #1 (convierte a HTML <pre>)

### Escenario 4: Sin TNEF
```
RESUMEN:
  TNEF: NO
  HTML directo: SÍ
```
**Acción**: Nada, GAIA ya funciona

### Escenario 5: TNEF corrupto (ERROR)
```
[ERROR] Procesando UID 12345: [TNEF error message]
```
**Acción**: Revisar formato TNEF especial o buscar tabla en attachments

---

## Pasos para Arreglar

### Paso 1: Diagnosticar (AHORA)

```bash
cd U:\USUARIOS\jose.paredes\Desktop\DocFlow\docflow\backend
python test_gaia_tnef.py > gaia_output.txt
```

Guardar el output en `gaia_output.txt` para análisis.

### Paso 2: Aplicar Solución (BASADO EN OUTPUT)

Ver documento `SOLUCION_GAIA_TNEF.md` para el código a cambiar.

**Ubicación principal:** `docflow/backend/services/imap_service.py` línea 82

Cambiar función `get_html_body()` por la versión mejorada que:
- Captura excepciones de TNEF
- Intenta htmlbody → rtfbody → body en orden
- Agrega logging detallado

### Paso 3: Instalar Dependencia (SI ES NECESARIO)

Si TNEF tiene rtfbody (Escenario 2):

```bash
# Activar virtual environment
cd docflow_env
Scripts\activate

# Instalar striprtf
pip install striprtf

# Desactivar
deactivate
```

### Paso 4: Reiniciar Backend

```bash
# Matar proceso FastAPI (Ctrl+C en la terminal)
# Reiniciar:
python -m uvicorn main:app --reload
```

### Paso 5: Probar

1. Abrir UI de DocFlow
2. Ir a "Email Assistants"
3. Buscar email GAIA
4. Hacer click en "preview"
5. Verificar que muestra la tabla

---

## Archivos de Documentación

### `DIAGNOSTICO_GAIA_TNEF.md`
- Análisis técnico completo del problema
- Comparación con TR, ACONEX, SENDOC
- Explicación de TNEF
- Próximos pasos

### `SOLUCION_GAIA_TNEF.md`
- Código listo para copiar/pegar
- FIX #1, #2, #3, #4 con detalles
- Plan de implementación paso a paso
- Testing

### `README_GAIA_DIAGNOSTICO.md` (este archivo)
- Guía rápida
- Cómo ejecutar scripts
- Qué esperar en el output

---

## Cambios Necesarios (RESUMEN)

### Archivo: `docflow/backend/services/imap_service.py`

**Actual (línea 99-103):**
```python
if part.get_content_type() == "application/ms-tnef":
    tnef_data = part.get_payload(decode=True)
    tnef = TNEF(tnef_data)
    if tnef.htmlbody:
        return tnef.htmlbody.decode("utf-8", errors="replace") if isinstance(tnef.htmlbody, bytes) else tnef.htmlbody
```

**Nuevo (más robusto):**
```python
if part.get_content_type() == "application/ms-tnef":
    logger.debug("TNEF encontrado, intentando decodificar...")
    try:
        tnef_data = part.get_payload(decode=True)
        if not tnef_data:
            logger.warning("TNEF payload vacío")
            continue

        tnef = TNEF(tnef_data)

        # Prioridad 1: htmlbody
        if tnef.htmlbody:
            content = tnef.htmlbody
            if isinstance(content, bytes):
                html = content.decode("utf-8", errors="replace")
            else:
                html = str(content)
            logger.debug(f"TNEF htmlbody encontrado: {len(html)} caracteres")
            return html

        # Prioridad 2: rtfbody (si striprtf instalado)
        if tnef.rtfbody:
            try:
                from striprtf.striprtf import rtf_to_text
                rtf_content = tnef.rtfbody
                if isinstance(rtf_content, bytes):
                    rtf_content = rtf_content.decode("utf-8", errors="replace")
                text = rtf_to_text(rtf_content)
                import html as html_module
                html = f"<html><body><pre>{html_module.escape(text)}</pre></body></html>"
                logger.debug(f"RTF convertido a HTML: {len(html)} caracteres")
                return html
            except ImportError:
                logger.warning("striprtf no instalado, fallback a body")
            except Exception as e:
                logger.warning(f"Error convirtiendo RTF: {e}, fallback a body")

        # Prioridad 3: body plano
        if tnef.body:
            content = tnef.body
            if isinstance(content, bytes):
                text = content.decode("utf-8", errors="replace")
            else:
                text = str(content)
            import html as html_module
            html = f"<html><body><pre>{html_module.escape(text)}</pre></body></html>"
            logger.debug(f"Body plano convertido a HTML: {len(html)} caracteres")
            return html

        logger.warning("TNEF sin contenido legible")

    except Exception as e:
        logger.error(f"Error decodificando TNEF: {e}", exc_info=True)
        continue
```

---

## Estimación de Esfuerzo

| Tarea | Tiempo | Dificultad |
|-------|--------|-----------|
| Ejecutar diagnóstico | 5 min | Trivial |
| Leer documentación | 10 min | Fácil |
| Aplicar FIX #1 | 5 min | Fácil |
| Instalar striprtf (si es necesario) | 1 min | Trivial |
| Reiniciar backend | 1 min | Trivial |
| Probar | 5 min | Fácil |
| **TOTAL** | **27 min** | **Fácil** |

---

## Checklist de Diagnóstico

- [ ] Ejecutar `python test_gaia_tnef.py`
- [ ] Guardar output en archivo
- [ ] Determinar tipo de TNEF (htmlbody/rtfbody/body)
- [ ] Leer `DIAGNOSTICO_GAIA_TNEF.md`
- [ ] Leer `SOLUCION_GAIA_TNEF.md`
- [ ] Confirmar cambios con José Paredes
- [ ] Aplicar FIX #1 a `imap_service.py`
- [ ] Instalar striprtf si Escenario 2
- [ ] Reiniciar backend
- [ ] Probar con email GAIA real
- [ ] Documentar resultados

---

## Contacto

Si hay problemas durante el proceso:

1. Revisar logs en la terminal de FastAPI (debe haber "TNEF" en logs)
2. Ejecutar `test_gaia_tnef.py` nuevamente para debugging
3. Comparar output con "Output esperado" en este documento

---

## Notas Adicionales

### ¿Por qué GAIA usa TNEF?
Technip es una empresa francesa que usa sistemas legacy con Outlook/Exchange. Algunos servidores de correo Outlook envían emails en TNEF automáticamente para preservar formato.

### ¿Necesito striprtf?
Solo si el output de `test_gaia_tnef.py` muestra `rtfbody > 0 bytes` (Escenario 2).

### ¿Qué pasa con los attachments?
Si la tabla está en un attachment (e.g., Excel), se requiere procesamiento adicional (no implementado aún).

### ¿Qué pasa si TNEF falla?
Con el FIX #1, la excepción se captura y loggea, pero el email no se procesa. Se retorna vacío y transmittal_service lanza error amigable.

---

**Última actualización**: 2026-03-04
