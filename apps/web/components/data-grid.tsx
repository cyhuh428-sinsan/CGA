"use client";

import { CSSProperties, isValidElement, ReactNode, useMemo, useState } from "react";

export type DataGridRow = {
  key: string;
  cells: ReactNode[];
  className?: string;
  searchText?: string;
};

export type DataGridSortDirection = "asc" | "desc";

export type DataGridSortState = {
  columnIndex: number;
  direction: DataGridSortDirection;
};

type DataGridProps = {
  variant?: "studio" | "admin";
  columns: ReactNode[];
  rows: DataGridRow[];
  template: string;
  className?: string;
  sortable?: boolean;
  sortableColumns?: boolean[];
  sortState?: DataGridSortState | null;
  onSort?: (nextSort: DataGridSortState) => void;
};

export function dataGridCellText(cell: ReactNode): string {
  if (cell === null || cell === undefined || typeof cell === "boolean") {
    return "";
  }
  if (typeof cell === "string" || typeof cell === "number" || typeof cell === "bigint") {
    return String(cell);
  }
  if (Array.isArray(cell)) {
    return cell.map(dataGridCellText).join(" ");
  }
  if (isValidElement<{ children?: ReactNode }>(cell)) {
    return dataGridCellText(cell.props.children);
  }
  return "";
}

function compareCellText(left: string, right: string, direction: DataGridSortDirection) {
  const leftNumber = Number(left.replaceAll(",", ""));
  const rightNumber = Number(right.replaceAll(",", ""));
  const bothNumeric = left.trim() !== "" && right.trim() !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
  const result = bothNumeric
    ? leftNumber - rightNumber
    : left.localeCompare(right, "ko-KR", { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

export function DataGrid({
  variant = "studio",
  columns,
  rows,
  template,
  className,
  sortable = true,
  sortableColumns,
  sortState,
  onSort,
}: DataGridProps) {
  const [internalSort, setInternalSort] = useState<DataGridSortState | null>(null);
  const activeSort = sortState ?? internalSort;
  const style = {
    "--data-grid-template": template,
  } as CSSProperties;
  const sortedRows = useMemo(() => {
    if (onSort || !activeSort) {
      return rows;
    }
    return [...rows].sort((left, right) =>
      compareCellText(
        dataGridCellText(left.cells[activeSort.columnIndex]),
        dataGridCellText(right.cells[activeSort.columnIndex]),
        activeSort.direction,
      ),
    );
  }, [activeSort, onSort, rows]);

  function isSortableColumn(column: ReactNode, index: number) {
    if (!sortable) {
      return false;
    }
    if (sortableColumns && sortableColumns[index] === false) {
      return false;
    }
    return dataGridCellText(column).trim().length > 0;
  }

  function requestSort(index: number) {
    const nextDirection: DataGridSortDirection =
      activeSort?.columnIndex === index && activeSort.direction === "asc" ? "desc" : "asc";
    const nextSort = { columnIndex: index, direction: nextDirection };
    if (onSort) {
      onSort(nextSort);
      return;
    }
    setInternalSort(nextSort);
  }

  return (
    <div className={`data-grid data-grid--${variant}${className ? ` ${className}` : ""}`} style={style}>
      <div className="data-grid__row data-grid__row--header">
        {columns.map((column, index) => {
          const canSort = isSortableColumn(column, index);
          const isActive = activeSort?.columnIndex === index;
          return (
            <div key={`header-${index}`} className="data-grid__cell">
              {canSort ? (
                <button
                  type="button"
                  className={`data-grid__sort-button${isActive ? " is-active" : ""}`}
                  onClick={() => requestSort(index)}
                >
                  <span>{column}</span>
                  <span aria-hidden="true" className="data-grid__sort-mark">
                    {isActive ? (activeSort.direction === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              ) : (
                column
              )}
            </div>
          );
        })}
      </div>

      {sortedRows.map((row) => (
        <div key={row.key} className={`data-grid__row${row.className ? ` ${row.className}` : ""}`}>
          {row.cells.map((cell, index) => (
            <div key={`${row.key}-${index}`} className="data-grid__cell">
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
