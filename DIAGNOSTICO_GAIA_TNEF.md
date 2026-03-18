# DIAGNÓSTICO: Problemas de Parseo de Emails GAIA con TNEF

**Fecha**: 2026-03-04
**Objetivo**: Identificar por qué los emails GAIA no se pueden parsear correctamente

---

## HALLAZGOS PRINCIPALES

### 1. El Problema Identificado

**Ubicación**: `docflow/backend/services/imap_service.py`, líneas 96-103

```python
# Intento 2: extraer HTML de TNEF (emails GAIA/Outlook)
if msg.is_multipart():
    for part in msg.walk():
        if part.get_content_type() == "application/ms-tnef":
            tnef_data = part.get_payload(decode=True)
            tnef = TNEF(tnef_data)
            if tnef.htmlbody:
                return tnef.htmlbody.decode("utf-8", errors="replace") if isinstance(tnef.htmlbody, bytes) else tnef.htmlbody
```

**El código INTENTA parsear TNEF, pero hay 3 problemas potenciales:**

#### A. Dependencia en `tnefparse`
- El módulo `tnefparse` está importado en línea 6
- **No hay manejo de excepciones** si `tnefparse` no está instalado o falla
- Si la importación falla, todo el módulo `imap_service` se rompe
- No hay fallback si `TNEF()` lanza excepción al procesar datos malformados

#### B. Estructura TNEF Variable
- No todos los emails GAIA contienen `tnef.htmlbody` como bytes
- Algunos TNEF pueden tener:
  - `tnef.rtfbody` en lugar de `htmlbody`
  - `tnef.body` en texto plano
  - Solo adjuntos (sin cuerpo de HTML)
  - Datos corrupto que causa excepción en `TNEF()`

#### C. Flujo de Ejecución Incompleto
- Si `tnef.htmlbody` está vacío, la función retorna `""` (línea 105)
- En `transmittal_service.preview_email()` línea 56-57:
  ```python
  html_body = imap_service.get_html_body(msg)
  if not html_body:
      raise ValueError("El email no contiene cuerpo HTML")
  ```
- **El email falla en preview** antes de llegar al parser

---

## 2. Flujo de Ejecución para GAIA

```
Email GAIA (TNEF)
    ↓
[imap_service.fetch_email()] → obtiene objeto `msg` completo
    ↓
[transmittal_service.preview_email()] → línea 44-45
    ├─ imap_service.get_html_body(msg) [línea 55]
    │  ├─ Intento 1: busca "text/html" directo [líneas 84-94]
    │  │  └─ GAIA no tiene text/html directo (usa TNEF)
    │  ├─ Intento 2: extrae de TNEF [líneas 97-103]
    │  │  ├─ Busca "application/ms-tnef" [línea 99]
    │  │  ├─ Decodifica TNEF(tnef_data) [línea 101]
    │  │  ├─ Accede tnef.htmlbody [línea 102]
    │  │  └─ ⚠️ PUNTO CRÍTICO: Si tnef_data es malformado,
    │  │      la excepción NO se captura
    │  └─ Retorna "" si no encuentra HTML [línea 105]
    ├─ Si html_body vacío: raise ValueError [línea 57]
    └─ Continúa → gaia_parser.parse(html_body, subject, received_time)
```

---

## 3. Mapeos de GAIA Existentes

**Status GAIA**: `base_parser.py` líneas 79-85
```python
GAIA_STATUS_MAP = {
    "Code 1": "Com. Mayores",
    "Code 2": "Com. Menores",
    "Code 3": "Aprobado",
    "Code 4": "Informativo",
    "Code 5": "Rechazado",
}
```

**Material GAIA**: `base_parser.py` líneas 34-36
```python
GAIA_MATERIAL_MAP = {
    "214726C": "CAUDAL",
    "7070000087": "TEMPERATURA",
}
```

**Cliente GAIA**: Usa `PO_CLIENT_MAP` línea 89
```python
'21472': 'TECHNIP/SYNKEDIA',  # ← GAIA usa este PO
```

**Parser GAIA**: `gaia_parser.py` líneas 46-146
- Busca tabla con columna "Reference"
- Extrae campos de "Reference": doc code, PO, Pedido, Supp
- Mapea estados del subject ("Code X")
- **Asume que `html_body` ya contiene HTML válido**

---

## 4. Problemas Específicos Identificados

### 4.1 Sin Manejo de Excepciones
Archivo: `imap_service.py` líneas 99-103

**Problema**: Si `tnefparse.TNEF()` falla:
```python
try:
    tnef_data = part.get_payload(decode=True)
    tnef = TNEF(tnef_data)  # ← PUEDE LANZAR EXCEPCIÓN
    if tnef.htmlbody:
        return tnef.htmlbody.decode("utf-8", errors="replace") if isinstance(tnef.htmlbody, bytes) else tnef.htmlbody
except Exception as e:
    # NO HAY MANEJADOR - la excepción sube sin control
    pass
```

### 4.2 Sin Fallback a rtfbody
Archivo: `gaia_parser.py` línea 46-47

El parser espera `html_body`, pero TNEF puede contener:
- `tnef.htmlbody` → None o bytes
- `tnef.rtfbody` → RTF formateado (requiere procesamiento)
- `tnef.body` → Texto plano (requiere HTML escaping)

### 4.3 Sin Logging/Debugging
No hay forma de ver:
- Si se encontró TNEF
- Qué contenido tiene el TNEF (htmlbody? rtfbody? attachments?)
- Dónde falló el parseo

---

## 5. Análisis de la Estructura TNEF

### TNEF es formato propietario de Microsoft
- Utilizado por Outlook/Exchange cuando envían emails en ciertos formatos
- Encapsula: HTML body, RTF body, plain text body, attachments
- Requiere librería `tnefparse` para decodificar

### Propiedades de tnefparse.TNEF:
```python
tnef = TNEF(payload_bytes)
tnef.htmlbody    # bytes o None
tnef.rtfbody     # bytes o None
tnef.body        # bytes o None
tnef.attachments # list de objetos Attachment
```

### Problema de GAIA Específico
GAIA es plataforma de Technip (empresa francesa), probablemente usando:
- Outlook/Exchange que envía emails en TNEF
- O cliente windows que no respeta content-type
- **Resultado**: El email contiene `application/ms-tnef` pero puede tener:
  - Solo RTF, no HTML
  - RTF corrupto que no se puede convertir
  - HTML dentro de RTF (requiere RTF parser adicional)
  - Adjuntos con la tabla HTML (no en cuerpo)

---

## 6. Comparación con TR, ACONEX, SENDOC

| Plataforma | Sender | Formato | Ubicación HTML | Problema |
|------------|--------|---------|-----------------|----------|
| **TR** | egesdoc@grupotr.es | HTML directo | `text/html` part | ✓ Funciona |
| **ACONEX** | noreply@aconex.com | HTML directo | `text/html` part | ✓ Funciona |
| **SENDOC** | adminsendoc@corporate.sener | HTML directo | `text/html` part | ✓ Funciona |
| **GAIA** | gaia, technip | TNEF encapsulado | `application/ms-tnef` | ⚠️ Problemático |

**Conclusión**: TR, ACONEX, SENDOC envían email estándar con `text/html` directo.
GAIA envía emails con `application/ms-tnef` que requiere decodificación especial.

---

## 7. Soluciones Recomendadas

### 7.1 Corto Plazo: Agregar Manejo de Excepciones

**Archivo**: `docflow/backend/services/imap_service.py`

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
                try:
                    tnef_data = part.get_payload(decode=True)
                    tnef = TNEF(tnef_data)

                    # Prioridad: htmlbody > rtfbody > body
                    if tnef.htmlbody:
                        content = tnef.htmlbody
                        if isinstance(content, bytes):
                            return content.decode("utf-8", errors="replace")
                        return str(content)

                    # Fallback a RTF (requiere rtf2html)
                    if tnef.rtfbody:
                        # TODO: Implementar RTF → HTML conversion
                        logger.warning("TNEF contiene RTF body, necesita rtf2html")
                        pass

                    # Fallback a texto plano
                    if tnef.body:
                        content = tnef.body
                        if isinstance(content, bytes):
                            text = content.decode("utf-8", errors="replace")
                        else:
                            text = str(content)
                        # Convertir a HTML escapeado
                        import html
                        return f"<html><body><pre>{html.escape(text)}</pre></body></html>"

                except Exception as e:
                    logger.error(f"Error decodificando TNEF: {e}", exc_info=True)
                    # Continúa al siguiente intento
                    continue

    return ""
```

### 7.2 Mediano Plazo: Agregar Logging

```python
import logging
logger = logging.getLogger(__name__)

def get_html_body(msg):
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()

            if content_type == "text/html":
                logger.debug(f"HTML directo encontrado")
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                return payload.decode(charset, errors="replace")

            elif content_type == "application/ms-tnef":
                logger.debug("TNEF encontrado, intentando decodificar...")
                try:
                    # ...
                except Exception as e:
                    logger.error(f"TNEF decode failed: {e}")

    logger.warning("No se encontró HTML en el email")
    return ""
```

### 7.3 Largo Plazo: Script de Diagnóstico

**Crear**: `docflow/backend/diagnose_gaia_emails.py`

Este script:
1. Conecta a IMAP
2. Busca emails de GAIA (sender contiene "gaia" o "technip")
3. Para cada email GAIA:
   - Examina estructura MIME
   - Si tiene `application/ms-tnef`:
     - Intenta decodificar
     - Imprime: htmlbody_len, rtfbody_len, body_len, attachments
   - Si tiene `text/html`: anota que es estándar
   - Si tiene ambos: muestra cuál es más grande

---

## 8. Script de Diagnóstico Creado

**Ubicación**: `docflow/backend/diagnose_tnef.py`

Este script (sin dependencia de tnefparse):
1. Conecta a IMAP con credenciales de `.env`
2. Busca últimos 100 emails
3. Filtra emails NO-TR (senders != egesdoc@grupotr.es)
4. Para cada email:
   - Imprime: From, Subject, Is multipart
   - Lista todas las MIME parts con content-type y tamaño
   - Marca cuáles tienen TNEF, HTML, texto plano
   - Muestra primeros 50 bytes de TNEF en hex

**Ejecución**:
```bash
cd docflow/backend
python diagnose_tnef.py
```

O usar el batch file:
```bash
run_diagnose.bat
```

---

## 9. Próximos Pasos

### Ejecutar el Diagnóstico
```bash
cd U:\USUARIOS\jose.paredes\Desktop\DocFlow\docflow\backend
python diagnose_tnef.py
```

### Analizar Resultado
- Buscar emails de GAIA en el output
- Ver si contienen `application/ms-tnef`
- Ver si la decodificación TNEF funciona
- Identificar si el problema es:
  - TNEF sin htmlbody (solo rtfbody/body)
  - TNEF corrupto
  - HTML dentro de RTF
  - Attachments en lugar de cuerpo

### Basado en Resultado
- **Si TNEF se decodifica bien**: Implementar fallback a rtfbody/body
- **Si TNEF es corrupto**: Buscar alternativa (e.g., extraer tabla de attachment)
- **Si está en RTF**: Agregar librería `striprtf` o similar

---

## 10. Resumen Ejecutivo

**Estado**: Código para parsear GAIA TNEF existe, pero:
1. **Sin manejo de excepciones** → emails GAIA rompen la app
2. **Sin fallback a rtfbody** → no soporta TNEF sin htmlbody
3. **Sin logging** → difícil debuggear

**Solución**:
- Agregar try/except alrededor de TNEF parsing
- Implementar fallback a rtfbody
- Agregar logging detallado
- Ejecutar diagnóstico para entender estructura real de GAIA

**Impacto**: GAIA emails no se pueden procesar hasta que se arregle `imap_service.get_html_body()`
