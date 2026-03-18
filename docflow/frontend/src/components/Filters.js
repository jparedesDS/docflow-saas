import React from "react";
import { useI18n } from "../contexts/I18nContext";

export default function Filters({ filters, onChange, onSearch }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <input
        type="text"
        placeholder={t('filterSearch')}
        value={filters.q || ""}
        onChange={(e) => onChange({ ...filters, q: e.target.value })}
        className="input-field flex-1 min-w-[200px]"
      />
      <input
        type="text"
        placeholder={t('filterStatus')}
        value={filters.estado || ""}
        onChange={(e) => onChange({ ...filters, estado: e.target.value })}
        className="input-field w-36"
      />
      <input
        type="text"
        placeholder={t('filterClient')}
        value={filters.cliente || ""}
        onChange={(e) => onChange({ ...filters, cliente: e.target.value })}
        className="input-field w-36"
      />
      <input
        type="text"
        placeholder={t('filterResponsible')}
        value={filters.responsable || ""}
        onChange={(e) => onChange({ ...filters, responsable: e.target.value })}
        className="input-field w-36"
      />
      <button onClick={onSearch} className="btn-primary">
        {t('filterApply')}
      </button>
    </div>
  );
}
