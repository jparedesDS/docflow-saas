"""Shared status classification constants."""

ESTADOS_APROBADOS = {"aprobado", "aprobado con comentarios"}
ESTADOS_DEVOLUCION = {"com. menores", "com. mayores", "rechazado", "comentado"}
ESTADOS_ENVIADOS = {"enviado"}
ESTADOS_PENDIENTES = {"enviado", "com. menores", "com. mayores", "rechazado", "comentado", ""}
ESTADOS_EXCLUIDOS = {"eliminado", "deleted", "borrado"}

CRITICO_VALUES = {"SÍ", "SI", "YES", "TRUE", "1", "X"}

def is_critico(value) -> bool:
    """Check if a document is marked as critical."""
    return str(value).strip().upper() in CRITICO_VALUES
