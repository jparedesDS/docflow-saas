from typing import List, Dict, Any
from datetime import datetime, timedelta


class AnalyticsService:
    """Calcula métricas de análisis a partir de los datos del monitoring."""

    ESTADOS_APROBADOS = {"aprobado"}
    ESTADOS_DEVOLUCION = {"com. menores", "com. mayores", "rechazado", "comentado"}
    ESTADOS_ENVIADOS = {"enviado"}

    def get_analytics_summary(self, docs: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not docs:
            return self._empty_summary()

        # ── KPIs globales ────────────────────────────────────────────────
        total = len(docs)
        dias_vals = [
            d["Días Devolución"]
            for d in docs
            if isinstance(d.get("Días Devolución"), (int, float)) and d["Días Devolución"] > 0
        ]
        velocidad_media = round(sum(dias_vals) / len(dias_vals), 1) if dias_vals else 0

        # Docs en riesgo: no aprobados, con > 15 días en espera
        docs_riesgo = sum(
            1 for d in docs
            if isinstance(d.get("Días Devolución"), (int, float))
            and d["Días Devolución"] > 15
            and str(d.get("Estado", "")).lower().strip() not in self.ESTADOS_APROBADOS
            and str(d.get("Crítico", "")).lower().strip() in ("sí", "si")
        )

        # Docs que vencen en < 3 días (Días Devolución entre 1 y 3, no aprobados)
        a_vencer_3d = sum(
            1 for d in docs
            if isinstance(d.get("Días Devolución"), (int, float))
            and 0 < d["Días Devolución"] <= 3
            and str(d.get("Estado", "")).lower().strip() not in self.ESTADOS_APROBADOS
        )

        # Totales por estado (para donut)
        total_aprobados = 0
        total_enviados = 0
        total_devoluciones = 0
        total_sin_enviar = 0
        for d in docs:
            estado = str(d.get("Estado", "") or "").lower().strip()
            if estado in self.ESTADOS_APROBADOS:
                total_aprobados += 1
            elif estado in self.ESTADOS_ENVIADOS:
                total_enviados += 1
            elif estado in self.ESTADOS_DEVOLUCION:
                total_devoluciones += 1
            else:
                total_sin_enviar += 1

        # Clientes OK (>= 75% aprobados)
        por_cliente_raw = self._agrupar_por_cliente(docs)
        clientes_ok = sum(1 for c in por_cliente_raw if c["pct"] >= 75)

        return {
            "velocidad_media_dias": velocidad_media,
            "clientes_ok": clientes_ok,
            "total_clientes": len(por_cliente_raw),
            "docs_riesgo": docs_riesgo,
            "a_vencer_3d": a_vencer_3d,
            "total_aprobados": total_aprobados,
            "total_enviados": total_enviados,
            "total_devoluciones": total_devoluciones,
            "total_sin_enviar": total_sin_enviar,
            "por_cliente": por_cliente_raw,
            "por_responsable": self._agrupar_por_responsable(docs),
            "por_responsable_doc": self._agrupar_por_responsable_doc(docs),
            "por_tipo_doc": self._agrupar_por_tipo_doc(docs),
            "urgencias": self._calcular_urgencias(docs),
            "heatmap_cliente": self._heatmap_cliente_estado(docs),
            "prediccion_pedidos": self._prediccion_pedidos(docs),
            "matriz_comercial_doc": self._matriz_comercial_doc(docs),
            "generado": datetime.now().strftime("%d/%m/%Y %H:%M"),
        }

    # ── Agrupaciones ────────────────────────────────────────────────────

    def _agrupar_por_cliente(self, docs: List[Dict]) -> List[Dict]:
        from collections import defaultdict
        grupos: Dict[str, dict] = defaultdict(lambda: {
            "total": 0, "aprobados": 0, "enviados": 0, "dias": []
        })

        for doc in docs:
            cliente = str(doc.get("Cliente", "") or "").strip() or "Sin Cliente"
            estado = str(doc.get("Estado", "") or "").lower().strip()
            dias = doc.get("Días Devolución")

            g = grupos[cliente]
            g["total"] += 1
            if estado in self.ESTADOS_APROBADOS:
                g["aprobados"] += 1
            if isinstance(dias, (int, float)) and dias > 0:
                g["dias"].append(dias)
            if estado in self.ESTADOS_ENVIADOS or estado in self.ESTADOS_DEVOLUCION:
                g["enviados"] += 1

        result = []
        for cliente, g in grupos.items():
            if g["enviados"] == 0 and g["aprobados"] == 0:
                continue  # Omitir clientes sin actividad
            pct = round(g["aprobados"] / g["total"] * 100) if g["total"] > 0 else 0
            media_dias = round(sum(g["dias"]) / len(g["dias"]), 1) if g["dias"] else 0
            result.append({
                "cliente": cliente,
                "media_dias": media_dias,
                "total_enviados": g["enviados"],
                "total": g["total"],
                "aprobados": g["aprobados"],
                "pct": pct,
            })

        result.sort(key=lambda x: x["media_dias"], reverse=True)
        return result

    def _agrupar_por_responsable(self, docs: List[Dict]) -> List[Dict]:
        from collections import defaultdict
        from utils.config import USERS
        grupos: Dict[str, dict] = defaultdict(lambda: {
            "total": 0, "aprobados": 0, "criticos": 0, "devoluciones": 0,
            "sin_enviar": 0, "dias_aprobados": []
        })
        # Asegurar que todos los miembros del equipo aparecen aunque no tengan docs
        for iniciales in USERS:
            grupos[iniciales]  # inicializa con valores en cero

        for doc in docs:
            resp = str(doc.get("Responsable", "") or "").strip() or "Sin Asignar"
            estado = str(doc.get("Estado", "") or "").lower().strip()
            critico = str(doc.get("Crítico", "") or "").lower().strip()

            g = grupos[resp]
            g["total"] += 1
            if estado in self.ESTADOS_APROBADOS:
                g["aprobados"] += 1
                dias = doc.get("Días Devolución")
                if isinstance(dias, (int, float)) and dias > 0:
                    g["dias_aprobados"].append(dias)
            if estado in self.ESTADOS_DEVOLUCION:
                g["devoluciones"] += 1
            if critico in ("sí", "si") and estado not in self.ESTADOS_APROBADOS:
                g["criticos"] += 1
            if not estado or estado not in (self.ESTADOS_APROBADOS | self.ESTADOS_DEVOLUCION | self.ESTADOS_ENVIADOS):
                g["sin_enviar"] += 1

        result = []
        for resp, g in grupos.items():
            pct = round(g["aprobados"] / g["total"] * 100) if g["total"] > 0 else 0
            velocidad_media = round(sum(g["dias_aprobados"]) / len(g["dias_aprobados"]), 1) if g["dias_aprobados"] else 0
            tasa_devolucion = round(g["devoluciones"] / g["total"] * 100) if g["total"] > 0 else 0
            result.append({
                "responsable": resp,
                "total": g["total"],
                "aprobados": g["aprobados"],
                "pct": pct,
                "criticos": g["criticos"],
                "devoluciones": g["devoluciones"],
                "sin_enviar": g["sin_enviar"],
                "velocidad_media": velocidad_media,
                "tasa_devolucion": tasa_devolucion,
            })

        OCULTAR_COMERCIAL = {"Sin Asignar", "RM", "RP", "SS", "JM", "JV", "EC", "JP"}
        result = [r for r in result if r["responsable"] not in OCULTAR_COMERCIAL]
        result.sort(key=lambda x: x["total"], reverse=True)
        return result

    def _agrupar_por_responsable_doc(self, docs: List[Dict]) -> List[Dict]:
        from collections import defaultdict
        grupos: Dict[str, dict] = defaultdict(lambda: {
            "total": 0, "aprobados": 0, "criticos": 0, "devoluciones": 0,
            "sin_enviar": 0, "dias_aprobados": [], "dias_envio_list": [], "revisiones_list": []
        })

        OCULTAR_DOC = {"SI", "ES", "Sin Asignar"}

        for doc in docs:
            resp = str(doc.get("Repsonsable", "") or "").strip() or "Sin Asignar"
            if resp in OCULTAR_DOC:
                continue
            estado = str(doc.get("Estado", "") or "").lower().strip()
            critico = str(doc.get("Crítico", "") or "").lower().strip()

            g = grupos[resp]
            g["total"] += 1
            if estado in self.ESTADOS_APROBADOS:
                g["aprobados"] += 1
                dias = doc.get("Días Devolución")
                if isinstance(dias, (int, float)) and dias > 0:
                    g["dias_aprobados"].append(dias)
            if estado in self.ESTADOS_DEVOLUCION:
                g["devoluciones"] += 1
            if critico in ("sí", "si") and estado not in self.ESTADOS_APROBADOS:
                g["criticos"] += 1
            if not estado or estado not in (self.ESTADOS_APROBADOS | self.ESTADOS_DEVOLUCION | self.ESTADOS_ENVIADOS):
                g["sin_enviar"] += 1

            dias_envio = doc.get("Días Envío")
            if isinstance(dias_envio, (int, float)) and dias_envio > 0:
                g["dias_envio_list"].append(dias_envio)

            revision = doc.get("Nº Revisión")
            if isinstance(revision, (int, float)) and revision > 0:
                g["revisiones_list"].append(revision)

        result = []
        for resp, g in grupos.items():
            pct = round(g["aprobados"] / g["total"] * 100) if g["total"] > 0 else 0
            velocidad_media = round(sum(g["dias_aprobados"]) / len(g["dias_aprobados"]), 1) if g["dias_aprobados"] else 0
            tasa_devolucion = round(g["devoluciones"] / g["total"] * 100) if g["total"] > 0 else 0
            dias_envio_media = round(sum(g["dias_envio_list"]) / len(g["dias_envio_list"]), 1) if g["dias_envio_list"] else 0
            revision_media = round(sum(g["revisiones_list"]) / len(g["revisiones_list"]), 1) if g["revisiones_list"] else 0
            result.append({
                "responsable": resp,
                "total": g["total"],
                "aprobados": g["aprobados"],
                "pct": pct,
                "criticos": g["criticos"],
                "devoluciones": g["devoluciones"],
                "sin_enviar": g["sin_enviar"],
                "velocidad_media": velocidad_media,
                "tasa_devolucion": tasa_devolucion,
                "dias_envio_media": dias_envio_media,
                "revision_media": revision_media,
            })

        result.sort(key=lambda x: x["total"], reverse=True)
        return result

    def _matriz_comercial_doc(self, docs: List[Dict]) -> List[Dict]:
        from collections import defaultdict
        grupos: Dict[tuple, dict] = defaultdict(lambda: {"total": 0, "aprobados": 0})

        OCULTAR_DOC = {"SI", "ES", "Sin Asignar"}

        for doc in docs:
            comercial = str(doc.get("Responsable", "") or "").strip() or "Sin Asignar"
            resp_doc = str(doc.get("Repsonsable", "") or "").strip() or "Sin Asignar"
            if resp_doc in OCULTAR_DOC:
                continue
            estado = str(doc.get("Estado", "") or "").lower().strip()
            key = (comercial, resp_doc)
            grupos[key]["total"] += 1
            if estado in self.ESTADOS_APROBADOS:
                grupos[key]["aprobados"] += 1

        result = []
        for (comercial, resp_doc), g in grupos.items():
            pct = round(g["aprobados"] / g["total"] * 100) if g["total"] > 0 else 0
            result.append({
                "comercial": comercial,
                "resp_doc": resp_doc,
                "total": g["total"],
                "aprobados": g["aprobados"],
                "pct": pct,
            })

        result.sort(key=lambda x: (x["comercial"], x["resp_doc"]))
        return result

    def _agrupar_por_tipo_doc(self, docs: List[Dict]) -> List[Dict]:
        from collections import defaultdict
        grupos: Dict[str, dict] = defaultdict(lambda: {
            "aprobado": 0, "enviado": 0, "com_menores": 0,
            "rechazado": 0, "sin_enviar": 0, "total": 0
        })

        for doc in docs:
            tipo = str(doc.get("Tipo Doc.", "") or "").strip() or "Sin Tipo"
            estado = str(doc.get("Estado", "") or "").lower().strip()

            g = grupos[tipo]
            g["total"] += 1
            if "aprobado" in estado:
                g["aprobado"] += 1
            elif estado == "enviado":
                g["enviado"] += 1
            elif "com. menores" in estado or "com. mayores" in estado or "comentado" in estado:
                g["com_menores"] += 1
            elif "rechazado" in estado:
                g["rechazado"] += 1
            else:
                g["sin_enviar"] += 1

        result = []
        for tipo, g in grupos.items():
            result.append({"tipo": tipo, **g})

        result.sort(key=lambda x: x["total"], reverse=True)
        return result

    def _calcular_urgencias(self, docs: List[Dict]) -> List[Dict]:
        urgencias = []
        for doc in docs:
            estado = str(doc.get("Estado", "") or "").lower().strip()
            if estado in self.ESTADOS_APROBADOS:
                continue
            dias = doc.get("Días Devolución")
            if not isinstance(dias, (int, float)) or dias <= 0:
                continue
            critico = str(doc.get("Crítico", "") or "").lower().strip()
            urgencias.append({
                "pedido": str(doc.get("Nº Pedido", "") or ""),
                "doc_eipsa": str(doc.get("Nº Doc. EIPSA", "") or ""),
                "titulo": str(doc.get("Título", "") or ""),
                "dias": int(dias),
                "cliente": str(doc.get("Cliente", "") or ""),
                "responsable": str(doc.get("Responsable", "") or ""),
                "estado": str(doc.get("Estado", "") or ""),
                "critico": critico in ("sí", "si"),
                "tipo": str(doc.get("Tipo Doc.", "") or ""),
            })

        urgencias.sort(key=lambda x: x["dias"], reverse=True)
        return urgencias[:10]

    def _heatmap_cliente_estado(self, docs: List[Dict]) -> List[Dict]:
        from collections import defaultdict
        grupos: Dict[str, dict] = defaultdict(lambda: {
            "aprobado": 0, "enviado": 0, "com_menores": 0,
            "rechazado": 0, "sin_enviar": 0, "total": 0
        })

        for doc in docs:
            cliente = str(doc.get("Cliente", "") or "").strip() or "Sin Cliente"
            estado = str(doc.get("Estado", "") or "").lower().strip()
            g = grupos[cliente]
            g["total"] += 1
            if "aprobado" in estado:
                g["aprobado"] += 1
            elif estado == "enviado":
                g["enviado"] += 1
            elif any(x in estado for x in ("com. menores", "com. mayores", "comentado")):
                g["com_menores"] += 1
            elif "rechazado" in estado:
                g["rechazado"] += 1
            else:
                g["sin_enviar"] += 1

        result = [{"cliente": c, **g} for c, g in grupos.items() if g["total"] > 0]
        result.sort(key=lambda x: x["total"], reverse=True)
        return result

    def _prediccion_pedidos(self, docs: List[Dict]) -> List[Dict]:
        from collections import defaultdict
        grupos: Dict[str, dict] = defaultdict(lambda: {
            "total": 0, "aprobados": 0, "fecha_pedido": None, "fecha_prevista": None
        })

        for doc in docs:
            pedido = str(doc.get("Nº Pedido", "") or "").strip()
            if not pedido:
                continue
            estado = str(doc.get("Estado", "") or "").lower().strip()
            g = grupos[pedido]
            g["total"] += 1
            if "aprobado" in estado:
                g["aprobados"] += 1

            # Fecha Pedido
            fp = doc.get("Fecha Pedido")
            if fp and g["fecha_pedido"] is None:
                try:
                    if isinstance(fp, str):
                        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
                            try:
                                fp = datetime.strptime(fp[:10], fmt)
                                break
                            except ValueError:
                                continue
                    g["fecha_pedido"] = fp if isinstance(fp, datetime) else None
                except Exception:
                    pass

            # Fecha Prevista
            fprev = doc.get("Fecha Prevista")
            if fprev and g["fecha_prevista"] is None:
                try:
                    if isinstance(fprev, str):
                        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
                            try:
                                fprev = datetime.strptime(fprev[:10], fmt)
                                break
                            except ValueError:
                                continue
                    g["fecha_prevista"] = fprev if isinstance(fprev, datetime) else None
                except Exception:
                    pass

        hoy = datetime.now()
        result = []
        for pedido, g in grupos.items():
            total = g["total"]
            aprobados = g["aprobados"]
            pendientes = total - aprobados
            pct = round(aprobados / total * 100) if total > 0 else 0

            dias_transcurridos = None
            if g["fecha_pedido"]:
                try:
                    dias_transcurridos = max((hoy.date() - g["fecha_pedido"].date()).days, 1)
                except Exception:
                    pass

            prediccion_fecha = None
            dias_restantes = None
            if dias_transcurridos and aprobados > 0 and pendientes > 0:
                velocidad = aprobados / dias_transcurridos
                dias_restantes = round(pendientes / velocidad)
                prediccion_fecha = (hoy + timedelta(days=dias_restantes)).strftime("%d/%m/%Y")

            fecha_prevista_str = None
            en_plazo = None
            pct_esperado = None
            if g["fecha_prevista"]:
                try:
                    fecha_prevista_str = g["fecha_prevista"].strftime("%d/%m/%Y")
                    if dias_restantes is not None:
                        fecha_fin_est = hoy + timedelta(days=dias_restantes)
                        en_plazo = fecha_fin_est.date() <= g["fecha_prevista"].date()
                    if g["fecha_pedido"] and dias_transcurridos is not None:
                        duracion = max((g["fecha_prevista"].date() - g["fecha_pedido"].date()).days, 1)
                        pct_esperado = round(min(max(dias_transcurridos / duracion * 100, 0), 100))
                except Exception:
                    pass

            result.append({
                "pedido": pedido,
                "total": total,
                "aprobados": aprobados,
                "pendientes": pendientes,
                "pct": pct,
                "pct_esperado": pct_esperado,
                "prediccion_fecha": prediccion_fecha,
                "dias_restantes": dias_restantes,
                "fecha_prevista": fecha_prevista_str,
                "en_plazo": en_plazo,
            })

        result.sort(key=lambda x: x["pct"])
        return result

    def _empty_summary(self) -> Dict[str, Any]:
        return {
            "velocidad_media_dias": 0,
            "clientes_ok": 0,
            "total_clientes": 0,
            "docs_riesgo": 0,
            "a_vencer_3d": 0,
            "total_aprobados": 0,
            "total_enviados": 0,
            "total_devoluciones": 0,
            "total_sin_enviar": 0,
            "por_cliente": [],
            "por_responsable": [],
            "por_responsable_doc": [],
            "por_tipo_doc": [],
            "urgencias": [],
            "heatmap_cliente": [],
            "prediccion_pedidos": [],
            "matriz_comercial_doc": [],
            "generado": datetime.now().strftime("%d/%m/%Y %H:%M"),
        }
