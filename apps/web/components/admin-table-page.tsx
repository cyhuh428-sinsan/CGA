"use client";

import { ReactNode } from "react";

import { DataGrid, type DataGridRow } from "@/components/data-grid";
import { useI18n } from "@/components/language-provider";
import { ADMIN_COMMON_CATALOGS, formatAdminText } from "@/lib/i18n/admin-common";

type AdminTablePageProps = {
  title: string;
  searchPlaceholder: string;
  totalText: string;
  pageSizeText?: string;
  columns: ReactNode[];
  rows: DataGridRow[];
  template: string;
  topRight?: ReactNode;
  toolbarLeftExtra?: ReactNode;
  toolbarRight?: ReactNode;
};

export function AdminTablePage({
  title,
  searchPlaceholder,
  totalText,
  pageSizeText,
  columns,
  rows,
  template,
  topRight,
  toolbarLeftExtra,
  toolbarRight,
}: AdminTablePageProps) {
  const { language } = useI18n();
  const copy = ADMIN_COMMON_CATALOGS[language];
  const resolvedPageSizeText = pageSizeText ?? formatAdminText(copy.pageSize, { count: 10 });
  return (
    <section className="admin-page">
      <h2>{title}</h2>

      <div className="admin-page__search-row">
        <label className="admin-page__search">
          <span aria-hidden="true">⌕</span>
          <input type="text" defaultValue="" placeholder={searchPlaceholder} />
        </label>

        <button type="button" className="admin-page__filter" aria-label={copy.filter}>
          ▾
        </button>

        {topRight ? <div className="admin-page__search-actions">{topRight}</div> : null}
      </div>

      <div className="admin-page__toolbar">
        <div className="admin-page__toolbar-left">
          <strong>{totalText}</strong>
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select defaultValue={resolvedPageSizeText}>
              <option value={resolvedPageSizeText}>{resolvedPageSizeText}</option>
            </select>
          </label>
          {toolbarLeftExtra}
        </div>

        {toolbarRight ? <div className="admin-page__toolbar-right">{toolbarRight}</div> : null}
      </div>

      <div className="admin-page__grid-scroll">
        <DataGrid variant="admin" columns={columns} rows={rows} template={template} />
      </div>

      <div className="admin-page__pagination">
        <button type="button">«</button>
        <button type="button" className="is-active">
          1
        </button>
        <button type="button">2</button>
        <button type="button">3</button>
        <button type="button">»</button>
      </div>
    </section>
  );
}
