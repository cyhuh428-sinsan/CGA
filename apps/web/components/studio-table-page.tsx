import Link from "next/link";
import { ReactNode } from "react";

import { DataGrid, type DataGridRow } from "@/components/data-grid";

type StudioTablePageProps = {
  header?: ReactNode;
  title?: string;
  searchPlaceholder: string;
  totalText: string;
  pageSizeText?: string;
  columns: ReactNode[];
  rows: DataGridRow[];
  template: string;
  searchRight?: ReactNode;
  toolbarLeftExtra?: ReactNode;
  toolbarRight?: ReactNode;
  simulatorHref?: string;
};

export function StudioTablePage({
  header,
  title,
  searchPlaceholder,
  totalText,
  pageSizeText = "10개씩 보기",
  columns,
  rows,
  template,
  searchRight,
  toolbarLeftExtra,
  toolbarRight,
  simulatorHref,
}: StudioTablePageProps) {
  return (
    <section className="studio-table-page">
      {header ? (
        header
      ) : title ? (
        <header className="studio-table-page__title-row">
          <h1>{title}</h1>
        </header>
      ) : null}

      <div className="studio-table-page__search-row">
        <label className="studio-table-page__search">
          <span aria-hidden="true">⌕</span>
          <input type="text" defaultValue="" placeholder={searchPlaceholder} />
        </label>

        <button type="button" className="studio-table-page__filter" aria-label="필터">
          ▾
        </button>

        {searchRight ? <div className="studio-table-page__search-actions">{searchRight}</div> : null}
      </div>

      <div className="studio-table-page__toolbar">
        <div className="studio-table-page__toolbar-left">
          <strong>{totalText}</strong>
          <button type="button" className="studio-table-page__page-size">
            {pageSizeText}
          </button>
          {toolbarLeftExtra}
        </div>

        {toolbarRight ? <div className="studio-table-page__toolbar-right">{toolbarRight}</div> : null}
      </div>

      <DataGrid variant="studio" columns={columns} rows={rows} template={template} />

      <div className="studio-table-page__pagination">
        <button type="button">◀</button>
        <button type="button" className="is-active">
          1
        </button>
        <button type="button">2</button>
        <button type="button">3</button>
        <button type="button">▶</button>
      </div>

      {simulatorHref ? (
        <Link href={simulatorHref} className="floating-simulator" aria-label="시뮬레이터 열기">
          <span className="floating-simulator__face">
            <span />
            <span />
          </span>
        </Link>
      ) : null}
    </section>
  );
}
