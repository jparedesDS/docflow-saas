# SOLUCIÓN: Parseo de Emails GAIA con TNEF

**Fecha**: 2026-03-04
**Status**: Listo para implementar

---

## RESUMEN EJECUTIVO

**Problema**: Emails GAIA llegan en formato TNEF (aplicación/ms-tnef) y no se pueden extraer las tablas HTML.

**Causa Raíz**:
1. `imap_service.get_html_body()` intenta decodificar TNEF pero sin manejo de excepciones
2. No hay fallback si TNEF solo contiene `rtfbody` o `body` (no `htmlbody`)
3. Sin logging para debuggear problemas

**Solución**: Agregar manejo robusto de TNEF en `imap_service.py`

---

## FIX #1: Mejorar get_html_body() en imap_service.py

**Archivo**: `docflow/backend/services/imap_service.py`

**Cambio**: Reemplazar función `get_html_body()` (líneas 82-105)

### Código Actual (PROBLEMÁTICO):
```python
def get_html_body(msg):
    # Intento 1: buscar text/html directo (TR, ACONEX, etc.)
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                return payload.decode(charset, errors="replace")
    else:
        if msg.get_content_type() == "text/html":
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace")

    # Intento 2: extraer HTML de TNEF (emails GAIA/Outlook)
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "application/ms-tnef":
                tnef_data = part.get_payload(decode=True)
                tnef = TNEF(tnef_data)
                if tnef.htmlbody:
                    return tnef.htmlbody.decode("utf-8", errors="replace") if isinstance(tnef.htmlbody, bytes) else tnef.htmlbody

    return ""
```

### Código Nuevo (PROPUESTO):
```python
def get_html_body(msg):
    """
    Extrae el cuerpo HTML del email, soportando múltiples formatos:
    1. text/html directo (TR, ACONEX, SENDOC)
    2. application/ms-tnef con htmlbody (GAIA/Outlook)
    3. TNEF con rtfbody (fallback)
    4. TNEF con body plano (último fallback)
    """
    # Intento 1: buscar text/html directo (TR, ACONEX, SENDOC)
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                logger.debug("HTML directo encontrado en part text/html")
                return payload.decode(charset, errors="replace")
    else:
        if msg.get_content_type() == "text/html":
            payload = msg.get_payload(decode=True)
            charset = msg.get_content_charset() or "utf-8"
            logger.debug("HTML directo encontrado (no multipart)")
            return payload.decode(charset, errors="replace")

    # Intento 2: extraer de TNEF (emails GAIA/Outlook)
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "application/ms-tnef":
                logger.debug("TNEF encontrado, intentando decodificar...")
                try:
                    tnef_data = part.get_payload(decode=True)

                    if not tnef_data:
                        logger.warning("TNEF payload vacío")
                        continue

                    tnef = TNEF(tnef_data)

                    # Prioridad 1: htmlbody (ideal)
                    if tnef.htmlbody:
                        content = tnef.htmlbody
                        if isinstance(content, bytes):
                            html = content.decode("utf-8", errors="replace")
                        else:
                            html = str(content)
                        logger.debug(f"TNEF htmlbody encontrado: {len(html)} caracteres")
                        return html

                    # Prioridad 2: rtfbody (requiere conversión)
                    if tnef.rtfbody:
                        logger.debug("TNEF htmlbody vacío, usando rtfbody")
                        # Si tenemos striprtf, usar; si no, convertir manualmente
                        try:
                            from striprtf.striprtf import rtf_to_text
                            rtf_content = tnef.rtfbody
                            if isinstance(rtf_content, bytes):
                                rtf_content = rtf_content.decode("utf-8", errors="replace")
                            text = rtf_to_text(rtf_content)
                            # Convertir texto plano a HTML
                            import html as html_module
                            html_escaped = html_module.escape(text)
                            html = f"<html><body><pre>{html_escaped}</pre></body></html>"
                            logger.debug(f"RTF convertido a HTML: {len(html)} caracteres")
                            return html
                        except ImportError:
                            logger.warning("striprtf no instalado, intentando fallback a body")
                        except Exception as e:
                            logger.warning(f"Error convirtiendo RTF: {e}, fallback a body")

                    # Prioridad 3: body plano
                    if tnef.body:
                        logger.debug("TNEF sin HTML/RTF, usando body plano")
                        content = tnef.body
                        if isinstance(content, bytes):
                            text = content.decode("utf-8", errors="replace")
                        else:
                            text = str(content)
                        # Convertir texto plano a HTML
                        import html as html_module
                        html_escaped = html_module.escape(text)
                        html = f"<html><body><pre>{html_escaped}</pre></body></html>"
                        logger.debug(f"Body plano convertido a HTML: {len(html)} caracteres")
                        return html

                    # TNEF sin contenido legible
                    logger.warning(f"TNEF sin htmlbody, rtfbody o body. Attachments: {len(tnef.attachments) if tnef.attachments else 0}")

                except Exception as e:
                    logger.error(f"Error decodificando TNEF: {e}", exc_info=True)
                    # Continúa a siguiente intento
                    continue

    logger.warning("No se encontró HTML en el email")
    return ""
```

### Cambios Clave:
1. **Try/except alrededor de TNEF** - Las excepciones no rompen la app
2. **Fallback a rtfbody** - Si no hay htmlbody, intenta rtf_to_text
3. **Fallback a body plano** - Si no hay RTF, convierte texto a HTML
4. **Logging detallado** - Para debuggear problemas
5. **Validación de payload** - Chequea si tnef_data no está vacío

---

## FIX #2: Agregar striprtf si no está instalado

**Archivo**: `docflow/backend/requirements.txt` (si existe) o instalar manualmente

Si GAIA tiene solo RTFbody, necesitamos `striprtf`:

```bash
# En el virtual environment:
pip install striprtf
```

O agregar a `requirements.txt`:
```
striprtf==0.0.26
```

**Nota**: Si GAIA solo tiene htmlbody o body plano, no es necesario.

---

## FIX #3: Agregar Logging a Transmittal Service

**Archivo**: `docflow/backend/services/transmittal_service.py`

**Cambio**: Mejorar mensaje de error en `preview_email()` (línea 56-57)

### Actual:
```python
html_body = imap_service.get_html_body(msg)
if not html_body:
    raise ValueError("El email no contiene cuerpo HTML")
```

### Mejorado:
```python
html_body = imap_service.get_html_body(msg)
if not html_body:
    sender = msg.get("From", "Unknown")
    subject = msg.get("Subject", "No Subject")
    raise ValueError(
        f"Email no contiene HTML extractable.\n"
        f"From: {sender}\n"
        f"Subject: {subject}\n"
        f"Este email puede tener estructura MIME no soportada."
    )
```

---

## FIX #4: Script de Diagnóstico

**Archivos Creados**:

### A. `diagnose_tnef.py`
- Analiza estructura MIME sin necesidad de tnefparse
- Lista todos los content-types en el inbox
- Marca dónde está el HTML (directo o TNEF)

### B. `test_gaia_tnef.py`
- Más completo que diagnose_tnef.py
- Intenta decodificar TNEF si está disponible
- Muestra htmlbody_len, rtfbody_len, body_len
- Detecta automáticamente emails GAIA

### C. `run_diagnose.bat`
- Batch file para ejecutar fácilmente el script desde Windows

---

## PLAN DE IMPLEMENTACIÓN

### Paso 1: Diagnosticar (AHORA)
```bash
cd docflow/backend
python test_gaia_tnef.py
```

Esto muestra:
- Qué emails tenemos de GAIA
- Si contienen TNEF
- Qué estructura tiene el TNEF (htmlbody? rtfbody? body?)

### Paso 2: Implementar Fix (Basado en Resultado)

**Si TNEF tiene htmlbody**:
- Aplicar FIX #1 (solo try/except)
- No es necesario striprtf

**Si TNEF tiene rtfbody**:
- Aplicar FIX #1 (con fallback rtfbody)
- Instalar striprtf (FIX #2)

**Si TNEF tiene solo body**:
- Aplicar FIX #1 (con fallback body)
- No es necesario striprtf

### Paso 3: Validar
Después de aplicar Fix #1:
```bash
# Reiniciar backend
# Intentar preview email GAIA desde UI
# Verificar en logs (FIX #1 agrega logging)
```

### Paso 4: Documentar
Agregar a docstring de GAIA parser:
```python
"""
Parser para emails GAIA/Technip (senders contienen 'gaia' o 'technip')

Características:
- Detecta emails TNEF automáticamente
- Soporta htmlbody, rtfbody y body plano
- Extrae transmittal code del subject (e.g. "214726C-TEN-EIPSA-...")
- Mapea statuses: Code 1-5 → estados españoles

Limitaciones:
- TNEF debe contener tabla HTML (ya sea en htmlbody, rtfbody o adjuntos)
- Si la tabla está en attachment, requiere procesamiento adicional
"""
```

---

## CÓDIGOS DE RESPUESTA ESPERADOS

Después de implementar, los emails GAIA deberían responder:

### Preview Email:
```json
{
  "platform": "GAIA",
  "subject": "[GAIA] Notification: 214726C-TEN-EIPSA-TN-OD-0024 - Code 3 - ...",
  "from": "gaia@technip.com",
  "date": "04-03-2026 14:30:00",
  "transmittal_code": "214726C-TEN-EIPSA-TN-OD-0024",
  "documents": [
    {
      "Doc. EIPSA": "214726C-TEN-EIPSA-SC-VDD-0001",
      "Doc. Cliente": "...",
      "Título": "...",
      "Rev.": "A",
      "Estado": "Aprobado",
      "Tipo de documento": "Listado",
      "Crítico": "Sí",
      "Cliente": "TECHNIP/SYNKEDIA",
      "Responsable": "...",
      "Nº Pedido": "...",
      "PO": "214726C",
      "Material": "CAUDAL",
      "Supp.": "S00",
      "Fecha": "04-03-2026",
      "Nº Transmittal": "214726C-TEN-EIPSA-TN-OD-0024"
    }
  ],
  "suggested_to": [...],
  "suggested_cc": [...]
}
```

---

## TESTING

### Test 1: Email GAIA con htmlbody
```python
def test_gaia_htmlbody():
    # Conectar y buscar email GAIA con htmlbody
    uid = "123"
    preview = transmittal_service.preview_email(uid)
    assert preview["platform"] == "GAIA"
    assert len(preview["documents"]) > 0
    assert preview["transmittal_code"] is not None
```

### Test 2: Email GAIA con rtfbody
```python
def test_gaia_rtfbody():
    # Similar al anterior, pero email tiene solo rtfbody
    # Después de instalar striprtf
    pass
```

### Test 3: Email GAIA con body plano
```python
def test_gaia_plaintext():
    # Similar, pero email tiene solo body
    # No debería fallar, solo convertir a HTML <pre>
    pass
```

---

## REFERENCIAS

### Archivos Clave:
- `docflow/backend/services/imap_service.py` (línea 82-105)
- `docflow/backend/services/parsers/gaia_parser.py` (completo)
- `docflow/backend/services/transmittal_service.py` (línea 55-61)

### Librerías Relevantes:
- `tnefparse` - Ya instalada, decodifica TNEF
- `striprtf` - Opcional, convierte RTF a texto plano

### Documentación:
- TNEF format: https://en.wikipedia.org/wiki/Tagged_Image_File_Format (NO, es ms-tnef)
- tnefparse: https://github.com/alexpilotti/tnefparse
- striprtf: https://github.com/dwilliss/striprtf

---

## CHECKLIST DE IMPLEMENTACIÓN

- [ ] Ejecutar `test_gaia_tnef.py` y guardar output
- [ ] Determinar qué tipo de TNEF contiene GAIA (htmlbody/rtfbody/body)
- [ ] Aplicar FIX #1 (mejorar get_html_body)
- [ ] Instalar striprtf si es necesario (FIX #2)
- [ ] Aplicar FIX #3 (mejorar mensajes de error)
- [ ] Aplicar FIX #4 (agregar logging)
- [ ] Reiniciar backend
- [ ] Probar preview de email GAIA
- [ ] Probar send notification desde email GAIA
- [ ] Verificar logs (debe haber "TNEF htmlbody encontrado")
- [ ] Documentar en README

---

## SOPORTE FUTURO

Si en el futuro aparecen problemas:

1. **TNEF corrupto o no decodificable**
   - Opción A: Usar `logger.error()` y retornar ""
   - Opción B: Implementar extractor de tablas en adjuntos

2. **RTF con formato especial**
   - Usar librería `python-docx` si el RTF viene de Word
   - O usar pandoc para convertir RTF → HTML

3. **Email sin tabla (solo adjuntos)**
   - Buscar archivos Excel/CSV en attachments
   - Parsear archivo en lugar de HTML

---

**Fin de Documento**
