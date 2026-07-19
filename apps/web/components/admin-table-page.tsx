import { ReactNode } from "react";

import { DataGrid, type DataGridRow } from "@/components/data-grid";

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
  pageSizeText = "10개씩 보기",
  columns,
  rows,
  template,
  topRight,
  toolbarLeftExtra,
  toolbarRight,
}: AdminTablePageProps) {
  return (
    <section className="admin-page">
      <h2>{title}</h2>

      <div className="admin-page__search-row">
        <label className="admin-page__search">
          <span aria-hidden="true">⌕</span>
          <input type="text" defaultValue="" placeholder={searchPlaceholder} />
        </label>

        <button type="button" className="admin-page__filter" aria-label="필터">
          ▾
        </button>

        {topRight ? <div className="admin-page__search-actions">{topRight}</div> : null}
      </div>

      <div className="admin-page__toolbar">
        <div className="admin-page__toolbar-left">
          <strong>{totalText}</strong>
          <label className="manual-main__mini-select manual-main__mini-select--select">
            <select defaultValue={pageSizeText}>
              <option value={pageSizeText}>{pageSizeText}</option>
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
