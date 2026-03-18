import io
from datetime import datetime

from repositories.instances import data_repo, consulta_repo
from services.analytics_service import AnalyticsService
from services.monitoring_service import MonitoringService

MESES_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

NAVY = "#1B3A5C"
CYAN = "#00AEEF"

ESTADO_MAP = {
    "aprobado": ("Aprobado", "#16A34A"),
    "enviado": ("Enviado", "#2563EB"),
    "com. menores": ("Com. Menores", "#D97706"),
    "com. mayores": ("Com. Mayores", "#DB2777"),
    "comentado": ("Comentado", "#CA8A04"),
    "rechazado": ("Rechazado", "#DC2626"),
    "sin enviar": ("Sin Enviar", "#64748B"),
}

try:
    from reportlab.pdfgen import canvas as pdfgen_canvas
    from reportlab.lib.pagesizes import A4 as _RL_A4
    from reportlab.lib.units import cm as _RL_CM
    from reportlab.lib import colors as _rl_colors

    class _NumberedCanvas(pdfgen_canvas.Canvas):
        """Canvas that adds 'Página X de Y' on every page."""

        def __init__(self, *args, **kwargs):
            pdfgen_canvas.Canvas.__init__(self, *args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._saved_page_states)
            for i, state in enumerate(self._saved_page_states, 1):
                self.__dict__.update(state)
                self._draw_page_number(i, total)
                pdfgen_canvas.Canvas.showPage(self)
            pdfgen_canvas.Canvas.save(self)

        def _draw_page_number(self, page_num, total):
            self.setFont("Helvetica", 8)
            self.setFillColor(_rl_colors.HexColor("#94A3B8"))
            self.drawCentredString(
                _RL_A4[0] / 2, 1.0 * _RL_CM,
                f"Página {page_num} de {total}",
            )

except ImportError:
    _NumberedCanvas = None


def _safe(text):
    """Escape XML entities for reportlab Paragraph."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _get_data(month: int, year: int):
    svc = MonitoringService(data_repo, consulta_repo)
    analytics = AnalyticsService()
    all_docs = svc.get_monitoring_data()

    # Filter by month/year if Fecha Env. Doc. available
    def _in_month(d):
        fecha = d.get("Fecha Env. Doc.", "")
        if not fecha:
            return True  # include undated
        try:
            s = str(fecha)[:10]
            dt = datetime.strptime(s, "%Y-%m-%d")
            return dt.year == year and dt.month == month
        except Exception:
            return True

    month_docs = [d for d in all_docs if _in_month(d)]
    summary = analytics.get_analytics_summary(all_docs)

    return all_docs, month_docs, summary


def generate_monthly_pdf(month: int, year: int) -> bytes:
    """Genera PDF mensual ejecutivo premium — 12 secciones."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER
        from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer,
                                        Table, TableStyle, KeepTogether,
                                        PageBreak)
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.piecharts import Pie
        from collections import Counter
        from utils.config import USERS
    except ImportError:
        raise ImportError("reportlab no instalado. Ejecuta: pip install reportlab")

    all_docs, month_docs, summary = _get_data(month, year)
    mes_nombre = MESES_ES[month] if 1 <= month <= 12 else str(month)
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    navy_rgb = colors.HexColor(NAVY)
    cyan_rgb = colors.HexColor(CYAN)
    w, h = A4

    # ── Estilos ──────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()
    section_style = ParagraphStyle(
        "MSection", parent=styles["Heading2"],
        fontSize=13, textColor=navy_rgb, spaceAfter=8, spaceBefore=14,
        fontName="Helvetica-Bold",
    )
    body_style = ParagraphStyle(
        "MBody", parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#374151"), leading=14,
    )
    cell_style = ParagraphStyle(
        "MCell", parent=styles["Normal"],
        fontSize=8, leading=10, textColor=colors.HexColor("#374151"),
    )
    cell_center = ParagraphStyle(
        "MCellC", parent=cell_style, alignment=TA_CENTER,
    )
    cell_bold = ParagraphStyle(
        "MCellB", parent=cell_style, fontName="Helvetica-Bold",
    )
    kpi_value_style = ParagraphStyle(
        "MKPIV", parent=styles["Normal"],
        fontSize=20, fontName="Helvetica-Bold", alignment=TA_CENTER, leading=24,
    )
    kpi_label_style = ParagraphStyle(
        "MKPIL", parent=styles["Normal"],
        fontSize=8, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER,
    )

    BASE_TS = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy_rgb),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3F5")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])

    # ── Canvas callbacks ─────────────────────────────────────────────────
    def _draw_first_page(c, doc):
        c.saveState()
        c.setFillColor(navy_rgb)
        c.rect(0, h - 4 * cm, w, 4 * cm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * cm, h - 1.2 * cm, "EIPSA")
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(w / 2, h - 2.2 * cm, "Informe Mensual de Documentación")
        c.setFillColor(cyan_rgb)
        c.setFont("Helvetica", 11)
        c.drawCentredString(w / 2, h - 2.9 * cm, f"{mes_nombre} {year} — Document Control")
        c.setStrokeColor(cyan_rgb)
        c.setLineWidth(2)
        c.line(0, h - 4 * cm, w, h - 4 * cm)
        _draw_footer(c)
        c.restoreState()

    def _draw_later_pages(c, doc):
        c.saveState()
        c.setFont("Helvetica", 9)
        c.setFillColor(navy_rgb)
        c.drawString(2 * cm, h - 1.2 * cm, f"EIPSA | Informe Mensual — {mes_nombre} {year}")
        c.setStrokeColor(cyan_rgb)
        c.setLineWidth(0.5)
        c.line(2 * cm, h - 1.4 * cm, w - 2 * cm, h - 1.4 * cm)
        _draw_footer(c)
        c.restoreState()

    def _draw_footer(c):
        c.setStrokeColor(cyan_rgb)
        c.setLineWidth(1)
        c.line(2 * cm, 1.5 * cm, w - 2 * cm, 1.5 * cm)
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#64748B"))
        c.drawString(2 * cm, 1.15 * cm, "EIPSA — Document Control")
        c.setFillColor(colors.HexColor("#94A3B8"))
        c.drawRightString(w - 2 * cm, 1.15 * cm, f"Generado por DocFlow — {now_str}")

    # ── Helpers ───────────────────────────────────────────────────────────
    def _name(initials):
        u = USERS.get(str(initials).strip(), {})
        return u.get("nombre", str(initials)) if u else str(initials)

    def _cpct(val):
        return "#16A34A" if val >= 75 else "#D97706" if val >= 50 else "#DC2626"

    def _ecol(estado):
        return ESTADO_MAP.get(str(estado).lower().strip(), ("", "#64748B"))[1]

    def _val_cell(val, color_hex):
        if val > 0:
            return Paragraph(f'<font color="{color_hex}"><b>{val}</b></font>', cell_center)
        return Paragraph('<font color="#94A3B8">0</font>', cell_center)

    def _kpi_card(value, label, color_hex):
        color = colors.HexColor(color_hex)
        vs = ParagraphStyle("kv", parent=kpi_value_style, textColor=color)
        inner = Table(
            [[Paragraph(str(value), vs)], [Paragraph(_safe(label), kpi_label_style)]],
            colWidths=[5 * cm], rowHeights=[1.2 * cm, 0.6 * cm],
        )
        inner.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (0, 0), 3, color),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return inner

    # ── Build ────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=4.5 * cm, bottomMargin=2.5 * cm,
    )
    story = []

    total_all = len(all_docs)
    total_mes = len(month_docs)
    aprobados = summary.get("total_aprobados", 0)
    pct_aprobados = round(aprobados / total_all * 100, 1) if total_all else 0
    docs_riesgo = summary.get("docs_riesgo", 0)
    a_vencer_3d = summary.get("a_vencer_3d", 0)
    vel_media = summary.get("velocidad_media_dias", 0)
    clientes_ok = summary.get("clientes_ok", 0)

    # ═══ S1. Resumen Ejecutivo ═══════════════════════════════════════════
    story.append(KeepTogether([
        Paragraph("1. Resumen Ejecutivo", section_style),
        Spacer(1, 4),
        Paragraph(
            f"Durante <b>{mes_nombre} {year}</b> se registraron <b>{total_mes}</b> documentos activos. "
            f"El portfolio total asciende a <b>{total_all}</b> documentos, de los cuales "
            f"el <b>{pct_aprobados}%</b> están aprobados. La velocidad media de respuesta "
            f"del cliente es de <b>{vel_media}</b> días. "
            f"Se identifican <b>{docs_riesgo}</b> documentos críticos en riesgo y "
            f"<b>{a_vencer_3d}</b> próximos a vencer en 3 días. "
            f"<b>{clientes_ok}</b> clientes mantienen ≥75% de aprobación.",
            body_style,
        ),
    ]))
    story.append(Spacer(1, 8))

    # ═══ S2. KPI Dashboard (3×2) ════════════════════════════════════════
    gap = ""
    row1 = [_kpi_card(total_all, "Total Documentos", "#2563EB"), gap,
            _kpi_card(aprobados, "Aprobados", "#16A34A"), gap,
            _kpi_card(f"{vel_media}d", "Vel. Media", "#4F46E5")]
    row2 = [_kpi_card(docs_riesgo, "En Riesgo", "#DC2626"), gap,
            _kpi_card(a_vencer_3d, "Vencen 3d", "#D97706"), gap,
            _kpi_card(clientes_ok, "Clientes OK", "#0D9488")]
    kpi_grid = Table([row1, row2],
                     colWidths=[5 * cm, 0.5 * cm, 5 * cm, 0.5 * cm, 5 * cm],
                     rowHeights=[2.2 * cm, 2.2 * cm])
    kpi_grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(KeepTogether([
        Paragraph("2. Indicadores Clave", section_style), Spacer(1, 4), kpi_grid,
    ]))
    story.append(Spacer(1, 10))

    # ═══ S3. Distribución por Estado (PIE + tabla) ═══════════════════════
    estado_counter = Counter(
        str(d.get("Estado", "") or "Sin enviar").strip().lower() or "sin enviar"
        for d in all_docs
    )
    pie_data, pie_labels, pie_colors = [], [], []
    for ek, cnt in estado_counter.most_common():
        lbl, col = ESTADO_MAP.get(ek, (ek.title(), "#64748B"))
        pie_data.append(cnt)
        pie_labels.append(lbl)
        pie_colors.append(col)

    drawing = Drawing(260, 170)
    if pie_data:
        pie = Pie()
        pie.x, pie.y, pie.width, pie.height = 50, 10, 130, 130
        pie.data = pie_data
        pie.sideLabels = True
        pie.sideLabelsOffset = 0.1
        pie.slices.labelRadius = 1.2
        pie.slices.strokeWidth = 0.5
        pie.slices.strokeColor = colors.white
        pie.slices.fontName = "Helvetica"
        pie.slices.fontSize = 7
        total_pie = sum(pie_data)
        for i, col in enumerate(pie_colors):
            pie.slices[i].fillColor = colors.HexColor(col)
            pct_slice = (pie_data[i] / total_pie * 100) if total_pie else 0
            if pct_slice >= 3:
                pie.slices[i].label_text = pie_labels[i]
            else:
                pie.slices[i].label_text = ""
        if len(pie_data) > 0:
            max_idx = pie_data.index(max(pie_data))
            pie.slices[max_idx].popout = 5
        drawing.add(pie)

    est_rows = [["Estado", "Cant.", "%"]]
    for ek, cnt in estado_counter.most_common():
        lbl, col = ESTADO_MAP.get(ek, (ek.title(), "#64748B"))
        pct = round(cnt / total_all * 100, 1) if total_all else 0
        est_rows.append([
            Paragraph(f'<font color="{col}"><b>{_safe(lbl)}</b></font>', cell_style),
            Paragraph(str(cnt), cell_center),
            Paragraph(f"{pct}%", cell_center),
        ])
    est_tbl = Table(est_rows, colWidths=[3.5 * cm, 2 * cm, 2 * cm])
    est_ts = TableStyle(BASE_TS.getCommands())
    est_ts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
    est_tbl.setStyle(est_ts)

    layout_s3 = Table([[drawing, est_tbl]], colWidths=[9 * cm, 8 * cm])
    layout_s3.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(KeepTogether([
        Paragraph("3. Distribución por Estado", section_style), Spacer(1, 4), layout_s3,
    ]))
    story.append(Spacer(1, 10))

    # ═══ S4. Documentos Críticos (top 10) ════════════════════════════════
    urgencias = summary.get("urgencias", [])[:10]
    story.append(Paragraph("4. Documentos Críticos Pendientes", section_style))
    story.append(Paragraph(
        "Documentos no aprobados marcados como críticos con más de 15 días de espera. Ordenados por antigüedad.",
        body_style,
    ))
    story.append(Spacer(1, 4))
    if urgencias:
        urg_data = [["Doc. EIPSA", "Título", "Cliente", "Resp.", "Días", "Estado"]]
        for u in urgencias:
            dias = u.get("dias", 0)
            dc = "#DC2626" if dias > 30 else "#D97706" if dias > 15 else "#374151"
            ec = _ecol(u.get("estado", ""))
            urg_data.append([
                Paragraph(_safe(u.get("doc_eipsa", "")), cell_style),
                Paragraph(_safe(u.get("titulo", "")), cell_style),
                Paragraph(_safe(u.get("cliente", "")), cell_style),
                Paragraph(_safe(_name(u.get("responsable", ""))), cell_style),
                Paragraph(f'<font color="{dc}"><b>{dias}</b></font>', cell_center),
                Paragraph(f'<font color="{ec}">{_safe(u.get("estado", ""))}</font>', cell_style),
            ])
        urg_tbl = Table(urg_data, colWidths=[3.2 * cm, 5 * cm, 2.5 * cm, 2 * cm, 1.3 * cm, 3 * cm], repeatRows=1)
        urg_ts = TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy_rgb),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFF5F5"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3F5")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
        for i, u in enumerate(urgencias, 1):
            d = u.get("dias", 0)
            if d > 30:
                urg_ts.add("BACKGROUND", (4, i), (4, i), colors.HexColor("#FEE2E2"))
            elif d > 15:
                urg_ts.add("BACKGROUND", (4, i), (4, i), colors.HexColor("#FEF3C7"))
        urg_tbl.setStyle(urg_ts)
        story.append(urg_tbl)
    else:
        story.append(Paragraph('<font color="#16A34A">Sin documentos críticos pendientes.</font>', body_style))
    story.append(Spacer(1, 10))

    # ═══ S5. Rendimiento por Responsable ═════════════════════════════════
    por_resp = summary.get("por_responsable_doc", [])
    s5 = [
        Paragraph("5. Rendimiento por Responsable", section_style),
        Spacer(1, 2),
        Paragraph(
            "Métricas por document controller. <b>Aprob%</b>: porcentaje aprobado. "
            "<b>Crít.</b>: docs críticos pendientes. <b>Devol%</b>: tasa de devolución del cliente. "
            "<b>Vel.</b>: media de días hasta aprobación. <b>Días Envío</b>: media de días internos hasta envío. "
            "<b>Rev. Media</b>: número medio de revisiones.",
            body_style,
        ),
        Spacer(1, 4),
    ]
    if por_resp:
        rd = [["Nombre", "Docs", "Aprob%", "Crít.", "Devol%", "Vel.", "Días Envío", "Rev. Media"]]
        for r in por_resp:
            pct = r.get("pct", 0)
            crit = r.get("criticos", 0)
            rd.append([
                Paragraph(_safe(_name(r.get("responsable", ""))), cell_bold),
                Paragraph(str(r.get("total", 0)), cell_center),
                Paragraph(f'<font color="{_cpct(pct)}"><b>{pct}%</b></font>', cell_center),
                Paragraph(f'<font color="{"#DC2626" if crit > 0 else "#374151"}"><b>{crit}</b></font>', cell_center),
                Paragraph(f"{r.get('tasa_devolucion', 0)}%", cell_center),
                Paragraph(f"{r.get('velocidad_media', 0)}d", cell_center),
                Paragraph(f"{r.get('dias_envio_media', 0)}d", cell_center),
                Paragraph(str(r.get("revision_media", 0)), cell_center),
            ])
        rt = Table(rd, colWidths=[4 * cm, 1.5 * cm, 2 * cm, 1.5 * cm, 2 * cm, 2 * cm, 2 * cm, 2 * cm])
        rts = TableStyle(BASE_TS.getCommands())
        rts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
        rt.setStyle(rts)
        s5.append(rt)
    else:
        s5.append(Paragraph("Sin datos de responsables.", body_style))
    story.append(KeepTogether(s5))
    story.append(Spacer(1, 10))

    # ═══ S6. Top Clientes ════════════════════════════════════════════════
    por_cliente = summary.get("por_cliente", [])[:10]
    s6 = [
        Paragraph("6. Rendimiento por Cliente", section_style),
        Spacer(1, 2),
        Paragraph(
            "Top 10 clientes ordenados por tiempo medio de respuesta. "
            "Estado <b>OK</b> si ≥75% de documentos aprobados; <b>Riesgo</b> si inferior.",
            body_style,
        ),
        Spacer(1, 4),
    ]
    if por_cliente:
        cd = [["Cliente", "Total", "Enviados", "Aprob%", "Media días", "Estado"]]
        for c in por_cliente:
            pct = c.get("pct", 0)
            md = c.get("media_dias", 0)
            mc = "#DC2626" if md > 20 else "#D97706" if md > 10 else "#16A34A"
            sl = "OK" if pct >= 75 else "Riesgo"
            sc = "#16A34A" if pct >= 75 else "#DC2626"
            cd.append([
                Paragraph(_safe(c.get("cliente", "—")), cell_style),
                Paragraph(str(c.get("total", 0)), cell_center),
                Paragraph(str(c.get("total_enviados", 0)), cell_center),
                Paragraph(f'<font color="{_cpct(pct)}"><b>{pct}%</b></font>', cell_center),
                Paragraph(f'<font color="{mc}">{md}d</font>', cell_center),
                Paragraph(f'<font color="{sc}"><b>{sl}</b></font>', cell_center),
            ])
        ct = Table(cd, colWidths=[4.5 * cm, 2 * cm, 2 * cm, 2.5 * cm, 3 * cm, 3 * cm])
        cts = TableStyle(BASE_TS.getCommands())
        cts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
        ct.setStyle(cts)
        s6.append(ct)
    else:
        s6.append(Paragraph("Sin datos de clientes.", body_style))
    story.append(KeepTogether(s6))
    story.append(Spacer(1, 10))

    # ═══ S7. Distribución por Tipo de Documento ═════════════════════════
    por_tipo = summary.get("por_tipo_doc", [])
    s7 = [Paragraph("7. Distribución por Tipo de Documento", section_style)]
    if por_tipo:
        td = [["Tipo", "Total", "Aprob.", "Enviado", "Com. Men.", "Rechaz.", "Sin Enviar"]]
        for t in por_tipo:
            td.append([
                Paragraph(_safe(t.get("tipo", "")), cell_bold),
                Paragraph(str(t.get("total", 0)), cell_center),
                _val_cell(t.get("aprobado", 0), "#16A34A"),
                _val_cell(t.get("enviado", 0), "#2563EB"),
                _val_cell(t.get("com_menores", 0), "#D97706"),
                _val_cell(t.get("rechazado", 0), "#DC2626"),
                _val_cell(t.get("sin_enviar", 0), "#64748B"),
            ])
        tt = Table(td, colWidths=[4 * cm, 1.8 * cm, 2 * cm, 2 * cm, 2.5 * cm, 2 * cm, 2.5 * cm], repeatRows=1)
        tts = TableStyle(BASE_TS.getCommands())
        tts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
        tt.setStyle(tts)
        s7.append(tt)
    else:
        s7.append(Paragraph("Sin datos por tipo.", body_style))
    story.append(KeepTogether(s7))
    story.append(Spacer(1, 10))

    # ═══ S8. Progreso de Pedidos ═════════════════════════════════════════
    prediccion = summary.get("prediccion_pedidos", [])
    at_risk = [
        p for p in prediccion
        if not p.get("en_plazo", True) or (p.get("pct") is not None and p["pct"] < 50)
    ][:8]
    s8 = [
        Paragraph("8. Progreso de Pedidos", section_style),
        Spacer(1, 2),
        Paragraph(
            "Pedidos en riesgo: progreso real inferior al esperado según fecha prevista de entrega, "
            "o con menos del 50% completado.",
            body_style,
        ),
        Spacer(1, 4),
    ]
    if at_risk:
        pd_ = [["Pedido", "Total", "Aprob.", "Progreso%", "Esperado%", "F. Prevista", "Estado"]]
        for p in at_risk:
            pct = p.get("pct", 0)
            pe = p.get("pct_esperado") or 0
            ep = p.get("en_plazo", True)
            pc = "#16A34A" if pct >= pe else "#DC2626"
            st = Paragraph('<font color="#16A34A">En plazo</font>', cell_center) if ep \
                else Paragraph('<font color="#DC2626"><b>Retrasado</b></font>', cell_center)
            pd_.append([
                Paragraph(_safe(p.get("pedido", "—")), cell_bold),
                Paragraph(str(p.get("total", 0)), cell_center),
                Paragraph(str(p.get("aprobados", 0)), cell_center),
                Paragraph(f'<font color="{pc}"><b>{pct}%</b></font>', cell_center),
                Paragraph(f"{pe}%", cell_center),
                Paragraph(_safe(str(p.get("fecha_prevista", "—") or "—")[:10]), cell_center),
                st,
            ])
        pt = Table(pd_, colWidths=[3 * cm, 1.5 * cm, 1.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm, 3 * cm])
        pts = TableStyle(BASE_TS.getCommands())
        pts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
        for i, p in enumerate(at_risk, 1):
            if not p.get("en_plazo", True):
                pts.add("BACKGROUND", (6, i), (6, i), colors.HexColor("#FEE2E2"))
        pt.setStyle(pts)
        s8.append(pt)
    else:
        s8.append(Paragraph('<font color="#16A34A">Todos los pedidos en plazo.</font>', body_style))
    story.append(KeepTogether(s8))
    story.append(Spacer(1, 10))

    # ═══ S9. Heatmap Cliente-Estado ══════════════════════════════════════
    heatmap = summary.get("heatmap_cliente", [])[:12]
    story.append(Paragraph("9. Mapa de Estado por Cliente", section_style))
    story.append(Paragraph(
        "Distribución de estados por cliente (top 12). "
        "Las celdas coloreadas indican documentos activos en cada estado.",
        body_style,
    ))
    story.append(Spacer(1, 4))
    if heatmap:
        hm = [["Cliente", "Total", "Aprob.", "Enviado", "Com. Men.", "Rechaz.", "Sin Enviar"]]
        hm_ts = TableStyle(BASE_TS.getCommands())
        hm_ts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
        scols = [
            ("aprobado", "#16A34A", "#DCFCE7"),
            ("enviado", "#2563EB", "#DBEAFE"),
            ("com_menores", "#D97706", "#FEF3C7"),
            ("rechazado", "#DC2626", "#FEE2E2"),
            ("sin_enviar", "#64748B", "#F1F5F9"),
        ]
        for ri, hi in enumerate(heatmap, 1):
            row = [Paragraph(_safe(hi.get("cliente", "")), cell_style),
                   Paragraph(f'<b>{hi.get("total", 0)}</b>', cell_center)]
            for cj, (key, tc, bg) in enumerate(scols, 2):
                v = hi.get(key, 0)
                if v > 0:
                    row.append(Paragraph(f'<font color="{tc}"><b>{v}</b></font>', cell_center))
                    hm_ts.add("BACKGROUND", (cj, ri), (cj, ri), colors.HexColor(bg))
                else:
                    row.append(Paragraph('<font color="#94A3B8">0</font>', cell_center))
            hm.append(row)
        ht = Table(hm, colWidths=[4 * cm, 2 * cm, 2 * cm, 2 * cm, 2.5 * cm, 2 * cm, 2.5 * cm], repeatRows=1)
        ht.setStyle(hm_ts)
        story.append(ht)
    else:
        story.append(Paragraph("Sin datos de clientes.", body_style))
    story.append(Spacer(1, 10))

    # ═══ S10. Matriz Comercial-Documentación ═════════════════════════════
    matriz = summary.get("matriz_comercial_doc", [])
    s10 = [
        Paragraph("10. Matriz Comercial — Document Controller", section_style),
        Spacer(1, 2),
        Paragraph(
            "Cruce entre comercial (responsable del pedido) y document controller (responsable del documento). "
            "Permite identificar cuellos de botella por combinación de equipo.",
            body_style,
        ),
        Spacer(1, 4),
    ]
    if matriz:
        md_ = [["Comercial", "Resp. Doc.", "Total", "Aprobados", "Aprob%"]]
        for m in matriz:
            pct = m.get("pct", 0)
            md_.append([
                Paragraph(_safe(_name(m.get("comercial", ""))), cell_style),
                Paragraph(_safe(_name(m.get("resp_doc", ""))), cell_style),
                Paragraph(str(m.get("total", 0)), cell_center),
                Paragraph(str(m.get("aprobados", 0)), cell_center),
                Paragraph(f'<font color="{_cpct(pct)}"><b>{pct}%</b></font>', cell_center),
            ])
        mt = Table(md_, colWidths=[4 * cm, 4 * cm, 2.5 * cm, 2.5 * cm, 4 * cm], repeatRows=1)
        mts = TableStyle(BASE_TS.getCommands())
        mts.add("ALIGN", (2, 1), (-1, -1), "CENTER")
        mt.setStyle(mts)
        s10.append(mt)
    else:
        s10.append(Paragraph("Sin datos de matriz comercial.", body_style))
    if len(matriz) <= 12:
        story.append(KeepTogether(s10))
    else:
        story.extend(s10)
    story.append(Spacer(1, 10))

    # ═══ S11. Reclamaciones ══════════════════════════════════════════════
    import os
    from utils.json_store import read_json
    claims_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "claims_log.json")
    all_claims = read_json(claims_path, {})
    if not isinstance(all_claims, dict):
        all_claims = {}
    month_claims = []
    for pedido, cdata in all_claims.items():
        if not isinstance(cdata, dict):
            continue
        for entry in cdata.get("history", []):
            sent = entry.get("sent_at", "")
            if not sent:
                continue
            try:
                dt = datetime.strptime(str(sent)[:10], "%Y-%m-%d")
                if dt.year == year and dt.month == month:
                    month_claims.append({"doc_key": pedido, "sent_at": sent})
            except Exception:
                pass
    s11 = [Paragraph("11. Reclamaciones", section_style)]
    if month_claims:
        cld = [["Pedido", "Fecha"]]
        for cl in month_claims:
            cld.append([
                Paragraph(_safe(cl.get("doc_key", "—")), cell_style),
                Paragraph(_safe(str(cl.get("sent_at", "—"))[:10]), cell_center),
            ])
        clt = Table(cld, colWidths=[9 * cm, 8 * cm])
        clt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy_rgb),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFBEB"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3F5")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        s11.append(clt)
    else:
        s11.append(Paragraph('<font color="#16A34A">Sin reclamaciones este mes.</font>', body_style))
    story.append(KeepTogether(s11))

    # ── Build PDF ────────────────────────────────────────────────────────
    from reportlab.pdfgen import canvas as _canvas_mod
    maker = _NumberedCanvas if _NumberedCanvas is not None else _canvas_mod.Canvas
    try:
        doc.build(
            story,
            onFirstPage=_draw_first_page,
            onLaterPages=_draw_later_pages,
            canvasmaker=maker,
        )
    except Exception:
        import traceback
        traceback.print_exc()
        raise
    return buf.getvalue()


def generate_weekly_pdf() -> bytes:
    """Genera PDF semanal profesional — 6 secciones, 2-3 páginas."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER
        from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer,
                                        Table, TableStyle, KeepTogether)
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics.charts.piecharts import Pie
        from collections import Counter
    except ImportError:
        raise ImportError("reportlab no instalado. Ejecuta: pip install reportlab")

    from services.weekly_summary_service import generate_summary_data
    from utils.config import USERS

    data = generate_summary_data()
    kpis = data.get("kpis", {})
    week_ending = data.get("week_ending", "—")
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    navy_rgb = colors.HexColor(NAVY)
    cyan_rgb = colors.HexColor(CYAN)
    w, h = A4

    # ── Estilos ──────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()
    section_style = ParagraphStyle(
        "WSection", parent=styles["Heading2"],
        fontSize=13, textColor=navy_rgb, spaceAfter=8, spaceBefore=14,
        fontName="Helvetica-Bold",
    )
    body_style = ParagraphStyle(
        "WBody", parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#374151"), leading=14,
    )
    cell_style = ParagraphStyle(
        "WCell", parent=styles["Normal"],
        fontSize=8, leading=10, textColor=colors.HexColor("#374151"),
    )
    cell_center = ParagraphStyle(
        "WCellC", parent=cell_style, alignment=TA_CENTER,
    )
    cell_bold = ParagraphStyle(
        "WCellB", parent=cell_style, fontName="Helvetica-Bold",
    )
    kpi_value_style = ParagraphStyle(
        "WKPIV", parent=styles["Normal"],
        fontSize=20, fontName="Helvetica-Bold", alignment=TA_CENTER, leading=24,
    )
    kpi_label_style = ParagraphStyle(
        "WKPIL", parent=styles["Normal"],
        fontSize=8, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER,
    )

    BASE_TS = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy_rgb),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3F5")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])

    # ── Canvas callbacks ─────────────────────────────────────────────────
    def _draw_first_page(c, doc):
        c.saveState()
        c.setFillColor(navy_rgb)
        c.rect(0, h - 4 * cm, w, 4 * cm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * cm, h - 1.2 * cm, "EIPSA")
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(w / 2, h - 2.2 * cm, "Informe Semanal de Documentación")
        c.setFillColor(cyan_rgb)
        c.setFont("Helvetica", 11)
        c.drawCentredString(w / 2, h - 2.9 * cm, f"Semana del {week_ending} — Document Control")
        c.setStrokeColor(cyan_rgb)
        c.setLineWidth(2)
        c.line(0, h - 4 * cm, w, h - 4 * cm)
        _draw_footer(c)
        c.restoreState()

    def _draw_later_pages(c, doc):
        c.saveState()
        c.setFont("Helvetica", 9)
        c.setFillColor(navy_rgb)
        c.drawString(2 * cm, h - 1.2 * cm, f"EIPSA | Informe Semanal — Semana del {week_ending}")
        c.setStrokeColor(cyan_rgb)
        c.setLineWidth(0.5)
        c.line(2 * cm, h - 1.4 * cm, w - 2 * cm, h - 1.4 * cm)
        _draw_footer(c)
        c.restoreState()

    def _draw_footer(c):
        c.setStrokeColor(cyan_rgb)
        c.setLineWidth(1)
        c.line(2 * cm, 1.5 * cm, w - 2 * cm, 1.5 * cm)
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#64748B"))
        c.drawString(2 * cm, 1.15 * cm, "EIPSA — Document Control")
        c.setFillColor(colors.HexColor("#94A3B8"))
        c.drawRightString(w - 2 * cm, 1.15 * cm, f"Generado por DocFlow — {now_str}")

    # ── Helpers ───────────────────────────────────────────────────────────
    def _name(initials):
        u = USERS.get(str(initials).strip(), {})
        return u.get("nombre", str(initials)) if u else str(initials)

    def _cpct(val):
        return "#16A34A" if val >= 75 else "#D97706" if val >= 50 else "#DC2626"

    def _ecol(estado):
        return ESTADO_MAP.get(str(estado).lower().strip(), ("", "#64748B"))[1]

    def _val_cell(val, color_hex):
        if val > 0:
            return Paragraph(f'<font color="{color_hex}"><b>{val}</b></font>', cell_center)
        return Paragraph('<font color="#94A3B8">0</font>', cell_center)

    def _kpi_card(value, label, color_hex):
        color = colors.HexColor(color_hex)
        vs = ParagraphStyle("wkv", parent=kpi_value_style, textColor=color)
        inner = Table(
            [[Paragraph(str(value), vs)], [Paragraph(_safe(label), kpi_label_style)]],
            colWidths=[5 * cm], rowHeights=[1.2 * cm, 0.6 * cm],
        )
        inner.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (0, 0), 3, color),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return inner

    # ── Build ────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=4.5 * cm, bottomMargin=2.5 * cm,
    )
    story = []

    total = data.get("total_docs", 0)
    total_aprobados = kpis.get("total_aprobados", 0)
    pct_aprob = round(total_aprobados / total * 100, 1) if total else 0
    docs_riesgo = kpis.get("docs_riesgo", 0)
    a_vencer_3d = kpis.get("a_vencer_3d", 0)
    vel_media = kpis.get("velocidad_media_dias", 0)
    clientes_ok = kpis.get("clientes_ok", 0)

    # ═══ S1. Carga de Trabajo por Responsable ════════════════════════════
    por_resp = kpis.get("por_responsable_doc", [])
    for r in por_resp:
        r["_pendientes"] = r.get("total", 0) - r.get("aprobados", 0)
    por_resp_sorted = sorted(por_resp, key=lambda x: x["_pendientes"], reverse=True)[:8]

    s1 = [
        Paragraph("1. Carga de Trabajo por Responsable", section_style),
        Spacer(1, 4),
    ]
    if por_resp_sorted:
        s1_data = [["Responsable", "Total", "Pend.", "Sin Enviar", "Devoluc.", "Crít."]]
        for r in por_resp_sorted:
            pend = r["_pendientes"]
            sin_env = r.get("sin_enviar", 0)
            devol = r.get("devoluciones", 0)
            crit = r.get("criticos", 0)
            # Color condicional: pendientes
            pc = "#DC2626" if pend > 20 else "#D97706" if pend > 10 else "#374151"
            s1_data.append([
                Paragraph(_safe(_name(r.get("responsable", ""))), cell_bold),
                Paragraph(str(r.get("total", 0)), cell_center),
                _val_cell(pend, pc),
                _val_cell(sin_env, "#DC2626" if sin_env > 0 else "#94A3B8"),
                _val_cell(devol, "#D97706" if devol > 0 else "#94A3B8"),
                _val_cell(crit, "#DC2626" if crit > 0 else "#94A3B8"),
            ])
        s1_tbl = Table(s1_data, colWidths=[4.5 * cm, 2 * cm, 2 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm], repeatRows=1)
        s1_ts = TableStyle(BASE_TS.getCommands())
        s1_ts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
        s1_tbl.setStyle(s1_ts)
        s1.append(s1_tbl)
    else:
        s1.append(Paragraph("Sin datos de responsables.", body_style))
    story.append(KeepTogether(s1))
    story.append(Spacer(1, 8))

    # ═══ S2. Indicadores Clave (3×2 grid) ════════════════════════════════
    gap = ""
    row1 = [_kpi_card(total, "Total Documentos", "#2563EB"), gap,
            _kpi_card(total_aprobados, "Aprobados", "#16A34A"), gap,
            _kpi_card(f"{vel_media}d", "Vel. Media", "#4F46E5")]
    row2 = [_kpi_card(docs_riesgo, "En Riesgo", "#DC2626"), gap,
            _kpi_card(a_vencer_3d, "Vencen 3d", "#D97706"), gap,
            _kpi_card(clientes_ok, "Clientes OK", "#0D9488")]
    kpi_grid = Table([row1, row2],
                     colWidths=[5 * cm, 0.5 * cm, 5 * cm, 0.5 * cm, 5 * cm],
                     rowHeights=[2.2 * cm, 2.2 * cm])
    kpi_grid.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(KeepTogether([
        Paragraph("2. Indicadores Clave", section_style), Spacer(1, 4), kpi_grid,
    ]))
    story.append(Spacer(1, 10))

    # ═══ S3. Distribución por Estado (PIE + tabla) ═══════════════════════
    estado_counts = data.get("estado_counts", {})
    pie_data, pie_labels, pie_colors = [], [], []
    for ek, cnt in sorted(estado_counts.items(), key=lambda x: -x[1]):
        lbl, col = ESTADO_MAP.get(ek.lower().strip(), (ek.title(), "#64748B"))
        pie_data.append(cnt)
        pie_labels.append(lbl)
        pie_colors.append(col)

    drawing = Drawing(260, 170)
    if pie_data:
        pie = Pie()
        pie.x, pie.y, pie.width, pie.height = 50, 10, 130, 130
        pie.data = pie_data
        pie.sideLabels = True
        pie.sideLabelsOffset = 0.1
        pie.slices.labelRadius = 1.2
        pie.slices.strokeWidth = 0.5
        pie.slices.strokeColor = colors.white
        pie.slices.fontName = "Helvetica"
        pie.slices.fontSize = 7
        total_pie = sum(pie_data)
        for i, col in enumerate(pie_colors):
            pie.slices[i].fillColor = colors.HexColor(col)
            pct_slice = (pie_data[i] / total_pie * 100) if total_pie else 0
            if pct_slice >= 3:
                pie.slices[i].label_text = pie_labels[i]
            else:
                pie.slices[i].label_text = ""
        if len(pie_data) > 0:
            max_idx = pie_data.index(max(pie_data))
            pie.slices[max_idx].popout = 5
        drawing.add(pie)

    est_rows = [["Estado", "Cant.", "%"]]
    for ek, cnt in sorted(estado_counts.items(), key=lambda x: -x[1]):
        lbl, col = ESTADO_MAP.get(ek.lower().strip(), (ek.title(), "#64748B"))
        pct = round(cnt / total * 100, 1) if total else 0
        est_rows.append([
            Paragraph(f'<font color="{col}"><b>{_safe(lbl)}</b></font>', cell_style),
            Paragraph(str(cnt), cell_center),
            Paragraph(f"{pct}%", cell_center),
        ])
    est_tbl = Table(est_rows, colWidths=[3.5 * cm, 2 * cm, 2 * cm])
    est_ts = TableStyle(BASE_TS.getCommands())
    est_ts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
    est_tbl.setStyle(est_ts)

    layout_s3 = Table([[drawing, est_tbl]], colWidths=[9 * cm, 8 * cm])
    layout_s3.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(KeepTogether([
        Paragraph("3. Distribución por Estado", section_style), Spacer(1, 4), layout_s3,
    ]))
    story.append(Spacer(1, 10))

    # ═══ S4. Documentos Críticos (top 5) ═════════════════════════════════
    urgencias = kpis.get("urgencias", [])[:5]
    story.append(Paragraph("4. Documentos Críticos", section_style))
    story.append(Spacer(1, 4))
    if urgencias:
        urg_data = [["Doc. EIPSA", "Título", "Cliente", "Resp.", "Días", "Estado"]]
        for u in urgencias:
            dias = u.get("dias", 0)
            dc = "#DC2626" if dias > 30 else "#D97706" if dias > 15 else "#374151"
            ec = _ecol(u.get("estado", ""))
            urg_data.append([
                Paragraph(_safe(u.get("doc_eipsa", "")), cell_style),
                Paragraph(_safe(u.get("titulo", "")), cell_style),
                Paragraph(_safe(u.get("cliente", "")), cell_style),
                Paragraph(_safe(_name(u.get("responsable", ""))), cell_style),
                Paragraph(f'<font color="{dc}"><b>{dias}</b></font>', cell_center),
                Paragraph(f'<font color="{ec}">{_safe(u.get("estado", ""))}</font>', cell_style),
            ])
        urg_tbl = Table(urg_data, colWidths=[3.2 * cm, 5 * cm, 2.5 * cm, 2 * cm, 1.3 * cm, 3 * cm], repeatRows=1)
        urg_ts = TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy_rgb),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFF5F5"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3F5")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
        for i, u in enumerate(urgencias, 1):
            d = u.get("dias", 0)
            if d > 30:
                urg_ts.add("BACKGROUND", (4, i), (4, i), colors.HexColor("#FEE2E2"))
            elif d > 15:
                urg_ts.add("BACKGROUND", (4, i), (4, i), colors.HexColor("#FEF3C7"))
        urg_tbl.setStyle(urg_ts)
        story.append(urg_tbl)
    else:
        story.append(Paragraph('<font color="#16A34A">Sin documentos críticos pendientes.</font>', body_style))
    story.append(Spacer(1, 10))

    # ═══ S5. Pedidos en Riesgo (top 5) ═══════════════════════════════════
    prediccion = kpis.get("prediccion_pedidos", [])
    at_risk = [
        p for p in prediccion
        if not p.get("en_plazo", True) or (p.get("pct") is not None and p["pct"] < 50)
    ][:5]
    s6 = [
        Paragraph("5. Pedidos en Riesgo", section_style),
        Spacer(1, 4),
    ]
    if at_risk:
        pd_ = [["Pedido", "Total", "Aprob.", "Progreso%", "Esperado%", "F. Prevista", "Estado"]]
        for p in at_risk:
            pct = p.get("pct", 0)
            pe = p.get("pct_esperado") or 0
            ep = p.get("en_plazo", True)
            pc = "#16A34A" if pct >= pe else "#DC2626"
            st = Paragraph('<font color="#16A34A">En plazo</font>', cell_center) if ep \
                else Paragraph('<font color="#DC2626"><b>Retrasado</b></font>', cell_center)
            pd_.append([
                Paragraph(_safe(p.get("pedido", "—")), cell_bold),
                Paragraph(str(p.get("total", 0)), cell_center),
                Paragraph(str(p.get("aprobados", 0)), cell_center),
                Paragraph(f'<font color="{pc}"><b>{pct}%</b></font>', cell_center),
                Paragraph(f"{pe}%", cell_center),
                Paragraph(_safe(str(p.get("fecha_prevista", "—") or "—")[:10]), cell_center),
                st,
            ])
        pt = Table(pd_, colWidths=[3 * cm, 1.5 * cm, 1.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm, 3 * cm], repeatRows=1)
        pts = TableStyle(BASE_TS.getCommands())
        pts.add("ALIGN", (1, 1), (-1, -1), "CENTER")
        for i, p in enumerate(at_risk, 1):
            if not p.get("en_plazo", True):
                pts.add("BACKGROUND", (6, i), (6, i), colors.HexColor("#FEE2E2"))
        pt.setStyle(pts)
        s6.append(pt)
    else:
        s6.append(Paragraph('<font color="#16A34A">Todos los pedidos en plazo.</font>', body_style))
    story.append(KeepTogether(s6))
    story.append(Spacer(1, 10))

    # ═══ S6. Reclamaciones ═══════════════════════════════════════════════
    claims = data.get("claims_detail", [])
    s7 = [Paragraph("6. Reclamaciones", section_style)]
    if claims:
        cld = [["Documento", "Cliente", "Fecha"]]
        for cl in claims:
            cld.append([
                Paragraph(_safe(cl.get("doc_key", "—")), cell_style),
                Paragraph(_safe(cl.get("client", "—")), cell_style),
                Paragraph(_safe(str(cl.get("sent_at", "—"))[:10]), cell_center),
            ])
        clt = Table(cld, colWidths=[7 * cm, 6 * cm, 4 * cm])
        clt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy_rgb),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFBEB"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDE3F5")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        s7.append(clt)
    else:
        s7.append(Paragraph('<font color="#16A34A">Sin reclamaciones esta semana.</font>', body_style))
    story.append(KeepTogether(s7))

    # ── Build PDF ────────────────────────────────────────────────────────
    from reportlab.pdfgen import canvas as _canvas_mod
    maker = _NumberedCanvas if _NumberedCanvas is not None else _canvas_mod.Canvas
    try:
        doc.build(
            story,
            onFirstPage=_draw_first_page,
            onLaterPages=_draw_later_pages,
            canvasmaker=maker,
        )
    except Exception:
        import traceback
        traceback.print_exc()
        raise
    return buf.getvalue()


def generate_preview_html(month: int, year: int) -> str:
    """HTML preview del informe mensual."""
    all_docs, month_docs, summary = _get_data(month, year)
    mes_nombre = MESES_ES[month] if 1 <= month <= 12 else str(month)

    aprobados = sum(1 for d in all_docs if str(d.get("Estado", "")).lower() == "aprobado")
    pct_aprobados = round(aprobados / len(all_docs) * 100, 1) if all_docs else 0
    urgencias = summary.get("urgencias", [])[:15]

    from collections import Counter
    estado_counter = Counter(
        str(d.get("Estado", "") or "Sin enviar").strip() or "Sin enviar"
        for d in all_docs
    )

    def est_rows():
        rows = ""
        for i, (estado, cnt) in enumerate(estado_counter.most_common()):
            pct = round(cnt / len(all_docs) * 100, 1) if all_docs else 0
            bg = "#F8FAFC" if i % 2 == 0 else "#FFFFFF"
            rows += f"<tr style='background:{bg}'><td style='padding:7px 12px'>{estado}</td><td style='padding:7px 12px;text-align:center'>{cnt}</td><td style='padding:7px 12px;text-align:center'>{pct}%</td></tr>"
        return rows

    def urg_rows():
        rows = ""
        for i, u in enumerate(urgencias):
            bg = "#FFF5F5" if i % 2 == 0 else "#FFFFFF"
            rows += f"<tr style='background:{bg}'><td style='padding:6px 10px'>{u.get('doc_eipsa','')}</td><td style='padding:6px 10px'>{u.get('titulo','')[:50]}</td><td style='padding:6px 10px'>{u.get('cliente','')}</td><td style='padding:6px 10px;text-align:center;font-weight:700;color:#DC2626'>{u.get('dias','')}</td><td style='padding:6px 10px'>{u.get('estado','')}</td></tr>"
        return rows

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Informe {mes_nombre} {year} — EIPSA</title>
<style>body{{font-family:Arial,sans-serif;background:#EEF2F9;margin:0;padding:32px 0}}</style>
</head>
<body>
<div style="max-width:860px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(30,45,125,0.12)">
  <div style="background:{NAVY};padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:20px">Informe Mensual de Documentación</h1>
    <p style="margin:6px 0 0;color:{CYAN};font-size:13px">{mes_nombre} {year} — EIPSA Document Control</p>
  </div>
  <div style="padding:24px 32px">
    <h2 style="color:{NAVY};font-size:14px;border-bottom:2px solid {CYAN};padding-bottom:6px">Resumen Ejecutivo</h2>
    <p style="color:#374151;font-size:13px">
      Durante <b>{mes_nombre} {year}</b> se registraron <b>{len(month_docs)}</b> documentos activos.
      Portfolio total: <b>{len(all_docs)}</b> docs — <b>{pct_aprobados}%</b> aprobados.
      Velocidad media: <b>{summary.get('velocidad_media_dias',0)}</b> días.
      Documentos en riesgo: <b>{summary.get('docs_riesgo',0)}</b>.
    </p>
    <h2 style="color:{NAVY};font-size:14px;border-bottom:2px solid {CYAN};padding-bottom:6px;margin-top:20px">Distribución por Estado</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:{NAVY};color:#fff"><th style="padding:8px 12px;text-align:left">Estado</th><th style="padding:8px 12px;text-align:center">Docs</th><th style="padding:8px 12px;text-align:center">%</th></tr></thead>
      <tbody>{est_rows()}</tbody>
    </table>
    {'<h2 style="color:' + NAVY + ';font-size:14px;border-bottom:2px solid ' + CYAN + ';padding-bottom:6px;margin-top:20px">Documentos Críticos Pendientes</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:' + NAVY + ';color:#fff"><th style="padding:7px 10px;text-align:left">Doc. EIPSA</th><th style="padding:7px 10px;text-align:left">Título</th><th style="padding:7px 10px;text-align:left">Cliente</th><th style="padding:7px 10px;text-align:center">Días</th><th style="padding:7px 10px;text-align:left">Estado</th></tr></thead><tbody>' + urg_rows() + '</tbody></table>' if urgencias else ''}
  </div>
  <div style="background:#F4F7FC;border-top:3px solid {CYAN};padding:12px 32px">
    <p style="margin:0;font-size:11px;color:#94A3B8">Generado por DocFlow · EIPSA — {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
  </div>
</div>
</body>
</html>"""
