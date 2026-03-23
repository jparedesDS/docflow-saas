"""
Unified search across all DocFlow data sources.
Searches documents, pedidos, claims, comments simultaneously.
Returns categorized results with relevance scoring.
"""
from typing import Any

from services.claim_service import ClaimService
from repositories.instances import monitoring_service


class UnifiedSearchService:
    def __init__(self):
        self.monitoring = monitoring_service
        self.claims = ClaimService()

    def search(self, query: str, limit: int = 20) -> dict[str, Any]:
        """Search across all data sources."""
        if not query or len(query.strip()) < 2:
            return {"results": [], "total": 0, "categories": {}}

        query = query.strip()
        docs = self.monitoring.get_monitoring_data()  # Load ONCE
        results = []

        # Search documents
        doc_results = self._search_documents(query, docs)
        results.extend(doc_results)

        # Search pedidos (aggregated view)
        pedido_results = self._search_pedidos(query, docs)
        results.extend(pedido_results)

        # Search claims
        claim_results = self._search_claims(query)
        results.extend(claim_results)

        # Sort by relevance score
        results.sort(key=lambda x: x.get("score", 0), reverse=True)

        # Categorize
        categories = {}
        for r in results:
            cat = r.get("category", "other")
            categories[cat] = categories.get(cat, 0) + 1

        return {
            "results": results[:limit],
            "total": len(results),
            "categories": categories,
            "query": query,
        }

    def _search_documents(self, query: str, docs: list) -> list:
        """Search in document fields."""
        q = query.lower()
        results = []

        for d in docs:
            score = 0
            matches = []

            # Exact match on doc number (highest relevance)
            doc_eipsa = str(d.get("Nº Doc. EIPSA", "")).lower()
            doc_cliente = str(d.get("Nº Doc. Cliente", "")).lower()
            if q in doc_eipsa:
                score += 100 if q == doc_eipsa else 80
                matches.append("Nº Doc. EIPSA")
            if q in doc_cliente:
                score += 90 if q == doc_cliente else 70
                matches.append("Nº Doc. Cliente")

            # Match on pedido number
            pedido = str(d.get("Nº Pedido", "")).lower()
            if q in pedido:
                score += 60
                matches.append("Nº Pedido")

            # Match on title
            titulo = str(d.get("Título", "")).lower()
            if q in titulo:
                score += 40
                matches.append("Título")

            # Match on client
            cliente = str(d.get("Cliente", "")).lower()
            if q in cliente:
                score += 30
                matches.append("Cliente")

            # Match on PO
            po = str(d.get("Nº PO", "")).lower()
            if q in po:
                score += 50
                matches.append("Nº PO")

            if score > 0:
                results.append({
                    "id": doc_eipsa,
                    "category": "document",
                    "title": d.get("Nº Doc. EIPSA", ""),
                    "subtitle": d.get("Título", ""),
                    "description": f"{d.get('Cliente', '')} — {d.get('Nº Pedido', '')}",
                    "estado": d.get("Estado", ""),
                    "score": score,
                    "matches": matches,
                    "data": {
                        "doc_eipsa": d.get("Nº Doc. EIPSA", ""),
                        "pedido": d.get("Nº Pedido", ""),
                        "cliente": d.get("Cliente", ""),
                        "estado": d.get("Estado", ""),
                        "responsable": d.get("Repsonsable", ""),
                    },
                })

        return results

    def _search_pedidos(self, query: str, docs: list) -> list:
        """Search and aggregate by pedido."""
        q = query.lower()

        # Group by pedido
        pedidos = {}
        for d in docs:
            pedido = str(d.get("Nº Pedido", "")).strip()
            if not pedido:
                continue
            pedidos.setdefault(pedido, []).append(d)

        results = []
        for pedido, pdocs in pedidos.items():
            score = 0
            if q in pedido.lower():
                score = 70

            # Check PO, client, material
            first = pdocs[0]
            po = str(first.get("Nº PO", "")).lower()
            cliente = str(first.get("Cliente", "")).lower()
            material = str(first.get("Material", "")).lower()

            if q in po:
                score = max(score, 60)
            if q in cliente:
                score = max(score, 50)
            if q in material:
                score = max(score, 40)

            if score > 0:
                total = len(pdocs)
                aprobados = sum(
                    1 for d in pdocs
                    if str(d.get("Estado", "")).lower() == "aprobado"
                )
                results.append({
                    "id": pedido,
                    "category": "pedido",
                    "title": pedido,
                    "subtitle": first.get("Cliente", ""),
                    "description": f"{total} docs — {round(aprobados / total * 100) if total else 0}% aprobado",
                    "score": score,
                    "matches": ["Nº Pedido"],
                    "data": {
                        "pedido": pedido,
                        "cliente": first.get("Cliente", ""),
                        "po": first.get("Nº PO", ""),
                        "total_docs": total,
                        "aprobados": aprobados,
                    },
                })

        return results

    def _search_claims(self, query: str) -> list:
        """Search in claims data."""
        q = query.lower()
        try:
            claimable = self.claims.get_claimable_pedidos()
        except Exception:
            return []

        results = []
        for c in claimable:
            score = 0
            pedido = str(c.get("pedido", "")).lower()
            cliente = str(c.get("cliente", "")).lower()

            if q in pedido:
                score = 55
            if q in cliente:
                score = max(score, 45)

            if score > 0:
                results.append({
                    "id": f"claim-{c.get('pedido', '')}",
                    "category": "claim",
                    "title": f"Reclamación: {c.get('pedido', '')}",
                    "subtitle": c.get("cliente", ""),
                    "description": f"{c.get('docs_count', 0)} docs, {c.get('max_dias', 0)} días — {c.get('urgency', '')}",
                    "score": score,
                    "matches": ["pedido" if q in pedido else "cliente"],
                    "data": c,
                })

        return results
