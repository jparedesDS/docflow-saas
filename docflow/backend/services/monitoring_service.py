import pandas as pd
import math
from datetime import datetime, date
from typing import List, Dict, Any
from repositories.excel_repository import ExcelRepository
from utils.cache import cache_result


class MonitoringService:
    """Genera la vista de monitoring mergeando data_erp + consulta_erp."""

    MONITORING_COLUMNS = [
        "Nº Pedido", "Responsable", "Nº Oferta", "Nº PO", "Cliente", "Material",
        "Fecha Pedido", "Fecha Prevista", "Nº Doc. Cliente", "Nº Doc. EIPSA",
        "Título", "Tipo Doc.", "Info/Review", "Repsonsable", "Días Envío",
        "Crítico", "Estado", "Nº Revisión", "Fecha Env. Doc.", "Días Devolución",
        "Seguimiento", "Historial Rev.",
    ]

    def __init__(self, data_repo: ExcelRepository, consulta_repo: ExcelRepository):
        self.data_repo = data_repo
        self.consulta_repo = consulta_repo

    @cache_result(ttl=60, key_prefix="monitoring")
    def get_monitoring_data(
        self,
        pedido: str = None,
        cliente: str = None,
        estado: str = None,
        responsable: str = None,
        query: str = None,
    ) -> List[Dict[str, Any]]:
        data_df = pd.DataFrame(self.data_repo.get_all())
        consulta_df = pd.DataFrame(self.consulta_repo.get_all())

        if data_df.empty:
            return []

        # Traer Responsable y Nº Oferta desde consulta_erp
        if not consulta_df.empty and "Nº Pedido" in consulta_df.columns:
            lookup = consulta_df[["Nº Pedido"]].copy()
            for col in ("Responsable", "Nº Oferta", "Fecha Pedido", "Fecha Prevista"):
                if col in consulta_df.columns:
                    lookup[col] = consulta_df[col]
            lookup = lookup.drop_duplicates(subset=["Nº Pedido"])
            data_df = data_df.merge(lookup, on="Nº Pedido", how="left", suffixes=("", "_consulta"))
            # Si data_erp ya tenía Fecha Pedido/Prevista, preferir la de consulta_erp cuando esté disponible
            for col in ("Fecha Pedido", "Fecha Prevista"):
                col_c = col + "_consulta"
                if col_c in data_df.columns:
                    if col not in data_df.columns:
                        data_df[col] = data_df[col_c]
                    else:
                        mask = data_df[col].isna() | (data_df[col].astype(str).str.strip() == "")
                        data_df.loc[mask, col] = data_df.loc[mask, col_c].values
                    data_df.drop(columns=[col_c], inplace=True)

        # Renombrar "Fecha" a "Fecha Env. Doc." si existe
        if "Fecha" in data_df.columns and "Fecha Env. Doc." not in data_df.columns:
            data_df.rename(columns={"Fecha": "Fecha Env. Doc."}, inplace=True)

        # Calcular "Días Devolución"
        data_df["Días Devolución"] = data_df.apply(self._calc_dias_devolucion, axis=1)

        # Calcular "Días Envío" si está vacío
        data_df["Días Envío"] = data_df.apply(self._calc_dias_envio, axis=1)

        # Reordenar columnas según monitoring report
        final_cols = [c for c in self.MONITORING_COLUMNS if c in data_df.columns]
        # Añadir columnas extra que existan pero no estén en la lista
        extra = [c for c in data_df.columns if c not in final_cols]
        merged = data_df[final_cols + extra]

        # Filtros
        if pedido:
            merged = merged[merged["Nº Pedido"].astype(str).str.contains(pedido, case=False, na=False)]
        if cliente:
            merged = merged[merged["Cliente"].astype(str).str.contains(cliente, case=False, na=False)]
        if estado:
            merged = merged[merged["Estado"].astype(str).str.contains(estado, case=False, na=False)]
        if responsable:
            resp_cols = [c for c in ["Responsable", "Repsonsable"] if c in merged.columns]
            if resp_cols:
                mask = pd.Series(False, index=merged.index)
                for rc in resp_cols:
                    mask = mask | merged[rc].astype(str).str.contains(responsable, case=False, na=False)
                merged = merged[mask]
        if query:
            q = query.lower()
            mask = merged.apply(
                lambda row: any(q in str(v).lower() for v in row.values), axis=1
            )
            merged = merged[mask]

        # Excluir documentos con estado "Eliminado"
        if "Estado" in merged.columns:
            merged = merged[~merged["Estado"].astype(str).str.strip().str.lower().isin(["eliminado", "deleted", "borrado"])]

        result = merged.fillna("").to_dict(orient="records")
        # Limpiar NaN en valores numéricos
        for row in result:
            for k, v in row.items():
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    row[k] = ""
        return result

    def get_monitoring_columns(self) -> List[str]:
        """Devuelve las columnas en orden del monitoring report."""
        data_cols = self.data_repo.get_columns()
        consulta_cols = self.consulta_repo.get_columns()
        # Columnas disponibles tras merge
        available = set(data_cols) | {"Responsable", "Nº Oferta", "Fecha Env. Doc.", "Días Devolución"}
        return [c for c in self.MONITORING_COLUMNS if c in available]

    @staticmethod
    def _normalize_pedido(pedido_raw: str) -> str:
        """Elimina sufijo de suplemento (-S00, -S01, -s02, etc.) para agrupar por pedido base."""
        import re
        p = pedido_raw.strip()
        # Quitar sufijos tipo -S00, -S01, -s02, -S10, etc.
        return re.sub(r'(?i)-s\d{1,3}$', '', p)

    @cache_result(ttl=120, key_prefix="status_global")
    def get_status_global(self) -> List[Dict[str, Any]]:
        """Agrupa documentos por Nº Pedido (sin suplemento) y calcula métricas de progreso."""
        docs = self.get_monitoring_data()
        if not docs:
            return []

        from collections import defaultdict
        pedidos = defaultdict(lambda: {
            "docs": [],
            "total": 0,
            "aprobados": 0,
            "pendientes": 0,
            "sin_enviar": 0,
            "reclamados": 0,
            "comentados": 0,
            "criticos": 0,
            "dias_max": 0,
            "suplementos": set(),
        })

        APROBADOS = ["aprobado"]
        RECLAMADOS = ["rechazado"]
        COMENTADOS = ["com. menores", "com. mayores", "comentado"]

        for doc in docs:
            pedido_raw = str(doc.get("Nº Pedido", "") or "").strip()
            if not pedido_raw:
                pedido_raw = "SIN PEDIDO"
            pedido = self._normalize_pedido(pedido_raw)
            # Registrar suplemento original
            if pedido_raw != pedido:
                pedidos[pedido]["suplementos"].add(pedido_raw)

            estado = str(doc.get("Estado", "") or "").lower().strip()
            critico = str(doc.get("Crítico", "") or "").lower().strip()

            p = pedidos[pedido]
            p["docs"].append(doc)
            p["total"] += 1

            if not estado or estado == "":
                p["sin_enviar"] += 1
            elif any(s in estado for s in APROBADOS):
                p["aprobados"] += 1
            elif any(s in estado for s in RECLAMADOS):
                p["reclamados"] += 1
            elif any(s in estado for s in COMENTADOS):
                p["comentados"] += 1
            else:
                p["pendientes"] += 1

            if critico in ("sí", "si"):
                p["criticos"] += 1

            dias = doc.get("Días Envío", "")
            try:
                d = int(float(dias))
                if d > p["dias_max"]:
                    p["dias_max"] = d
            except (ValueError, TypeError):
                pass

        result = []
        for pedido, data in pedidos.items():
            pct = round((data["aprobados"] / data["total"]) * 100) if data["total"] > 0 else 0
            first = data["docs"][0] if data["docs"] else {}
            suplementos = sorted(data["suplementos"])
            result.append({
                "pedido": pedido,
                "cliente": str(first.get("Cliente", "") or ""),
                "responsable": str(first.get("Repsonsable", "") or ""),
                "npo": str(first.get("Nº PO", "") or ""),
                "noferta": str(first.get("Nº Oferta", "") or ""),
                "material": str(first.get("Material", "") or ""),
                "total": data["total"],
                "aprobados": data["aprobados"],
                "pendientes": data["pendientes"],
                "sin_enviar": data["sin_enviar"],
                "reclamados": data["reclamados"],
                "comentados": data["comentados"],
                "criticos": data["criticos"],
                "pct_completado": pct,
                "dias_max": data["dias_max"],
                "suplementos": len(suplementos),
                "suplementos_detalle": suplementos,
            })

        # Ordenar: menos completados primero (más urgentes arriba)
        result.sort(key=lambda x: (x["pct_completado"], -x["criticos"]))
        return result

    def get_monitoring_report_sections(self) -> Dict[str, Any]:
        """Devuelve los datos del monitoring report divididos en secciones + KPIs."""
        docs = self.get_monitoring_data()
        if not docs:
            return {
                "enviados": [], "devoluciones": [], "criticos": [], "criticos_15d": [],
                "sin_enviar": [], "status_global": [], "kpis": {}
            }

        ESTADOS_DEVOLUCION = {"com. menores", "com. mayores", "rechazado", "comentado"}

        enviados, devoluciones, criticos, sin_enviar = [], [], [], []

        for doc in docs:
            estado = str(doc.get("Estado", "") or "").lower().strip()
            critico = str(doc.get("Crítico", "") or "").lower().strip()
            es_critico = critico in ("sí", "si")

            if not estado or estado == "sin enviar":
                sin_enviar.append(doc)
            elif estado == "enviado":
                enviados.append(doc)
            elif any(s in estado for s in ESTADOS_DEVOLUCION):
                devoluciones.append(doc)

            if es_critico and "aprobado" not in estado and "eliminado" not in estado:
                criticos.append(doc)

        criticos_15d = [
            d for d in criticos
            if isinstance(d.get("Días Devolución"), (int, float)) and d["Días Devolución"] >= 15
        ]

        total = len(docs)
        aprobados = sum(1 for d in docs if str(d.get("Estado", "")).lower().strip() == "aprobado")
        pct_completado = round((aprobados / total * 100), 1) if total > 0 else 0

        dias_devolucion_vals = [
            d["Días Devolución"] for d in devoluciones
            if isinstance(d.get("Días Devolución"), (int, float)) and d["Días Devolución"] > 0
        ]
        media_dias = round(sum(dias_devolucion_vals) / len(dias_devolucion_vals), 1) if dias_devolucion_vals else 0

        kpis = {
            "total": total,
            "aprobados": aprobados,
            "enviados": len(enviados),
            "devoluciones": len(devoluciones),
            "criticos": len(criticos),
            "criticos_15d": len(criticos_15d),
            "sin_enviar": len(sin_enviar),
            "pct_completado": pct_completado,
            "media_dias_devolucion": media_dias,
            "generado": datetime.now().strftime("%d/%m/%Y %H:%M"),
        }

        return {
            "all_docs": docs,          # Todos los docs (para ALL DOC. sheet y STATUS GLOBAL)
            "enviados": enviados,
            "devoluciones": devoluciones,
            "criticos": criticos,      # El Excel los splitea internamente en ≤15 y >15
            "criticos_15d": criticos_15d,
            "sin_enviar": sin_enviar,
            "status_global": self.get_status_global(),
            "kpis": kpis,
        }

    def _parse_date(self, val):
        if pd.isna(val) or val == "":
            return None
        if isinstance(val, (datetime, date)):
            return val if isinstance(val, datetime) else datetime.combine(val, datetime.min.time())
        s = str(val).strip()
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(s.split(" ")[0] if "T" not in s else s.split("T")[0], fmt)
            except ValueError:
                continue
        return None

    def _calc_dias_devolucion(self, row):
        """Calcula días desde envío de documento hasta hoy (0 si está aprobado)."""
        estado = str(row.get("Estado", "")).lower().strip()
        if "aprobado" in estado:
            return 0
        fecha_env = row.get("Fecha Env. Doc.") or row.get("Fecha", "")
        d = self._parse_date(fecha_env)
        if d:
            return (datetime.now() - d).days
        return ""

    def _calc_dias_envio(self, row):
        """Calcula días entre fecha pedido y fecha envío doc, o hasta hoy si no enviado."""
        existing = row.get("Días Envío")
        if existing != "" and not pd.isna(existing):
            try:
                return int(float(existing))
            except (ValueError, TypeError):
                pass
        fecha_pedido = self._parse_date(row.get("Fecha Pedido"))
        fecha_env = self._parse_date(row.get("Fecha Env. Doc.") or row.get("Fecha"))
        if fecha_pedido and fecha_env:
            return (fecha_env - fecha_pedido).days
        if fecha_pedido:
            return (datetime.now() - fecha_pedido).days
        return ""
