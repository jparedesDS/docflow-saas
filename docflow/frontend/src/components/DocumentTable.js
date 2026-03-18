import React, { useState, useEffect, useRef } from "react";
import StatusBadge from "./StatusBadge";
import { useI18n } from "../contexts/I18nContext";

const isStatusCol = (col) =>
  ["estado", "status", "situacion"].includes(col.toLowerCase().replace(/[\s.]+/g, "_"));

const isCriticalCol = (col) =>
  ["crítico", "critico", "critical"].includes(col.toLowerCase().trim());

function SkeletonTable() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="h-4 bg-card-hover rounded w-1/3 animate-pulse" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex gap-4">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-4 bg-card-hover rounded animate-pulse flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DocumentTable({ documents, columns, loading, onRowClick }) {
  const { t } = useI18n();
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const debounceRef = useRef(null);

  // Debounce filter
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFilter(filter);
      setPage(0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [filter]);

  if (loading) return <SkeletonTable />;

  if (!documents.length) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <svg className="w-12 h-12 text-text-muted mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-text-muted font-medium">{t('dtNoDocuments')}</p>
      </div>
    );
  }

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  let filtered = documents;
  if (debouncedFilter) {
    const q = debouncedFilter.toLowerCase();
    filtered = documents.filter((doc) =>
      columns.some((col) => String(doc[col] ?? "").toLowerCase().includes(q))
    );
  }

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      const va = String(a[sortCol] ?? "");
      const vb = String(b[sortCol] ?? "");
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('dtFilterTable')}
            className="input-field w-64 pl-9"
          />
        </div>
        <span className="text-sm text-text-muted font-medium">{filtered.length} {t('docs')}</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card-hover border-b border-border">
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-4 py-3 text-left font-semibold text-text-muted cursor-pointer hover:bg-card-hover select-none whitespace-nowrap text-xs uppercase tracking-wider"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {sortCol === col && (
                        <svg className={`w-3 h-3 transition-transform ${sortAsc ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((doc, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick && onRowClick(doc)}
                  className={`hover:bg-card-hover transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  style={{ borderLeft: "2px solid transparent", transition: "border-color 0.15s, background-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderLeftColor = "var(--accent)"}
                  onMouseLeave={e => e.currentTarget.style.borderLeftColor = "transparent"}
                >
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-3 whitespace-nowrap">
                      {isStatusCol(col) ? (
                        <StatusBadge status={String(doc[col] || "")} />
                      ) : isCriticalCol(col) && doc[col] ? (
                        <span className="inline-flex items-center gap-1 text-red-500 font-bold text-xs bg-red-500/10 px-2 py-0.5 rounded">
                          !! {String(doc[col])}
                        </span>
                      ) : (
                        <span className="text-text-main">{formatCell(doc[col])}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card-hover">
            <p className="text-xs text-text-muted">
              {t('showing')} {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)} {t('of')} {filtered.length}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
              >
                {t('dtPrevious')}
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="btn-secondary px-3 py-1 text-xs disabled:opacity-40"
              >
                {t('dtNext')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCell(val) {
  if (val === null || val === undefined || val === "") return <span className="text-text-muted">—</span>;
  const s = String(val);
  if (s.includes("T") && s.includes("-") && s.length > 10) return s.split("T")[0];
  return s;
}
