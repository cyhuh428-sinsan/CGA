"use client";

import { useCallback, useState } from "react";

import { AdminHistoryTablePage } from "@/components/admin-history-table-page";
import {
  fetchTrainingHistory,
  type AdminNluQualityDiagnosticItem,
  type AdminTrainingHistoryItem,
} from "@/lib/admin-api";
import { getNluModelLabel, getNluTypeLabel, normalizeNluType } from "@/lib/nlu-options";
import { useI18n } from "@/components/language-provider";
import { ADMIN_PAGE_CATALOGS } from "@/lib/i18n/admin-pages";
import {
  ADMIN_TRAINING_HISTORY_CATALOGS,
  formatTrainingHistoryText,
  type AdminTrainingHistoryCatalog,
} from "@/lib/i18n/admin-training-history";
import type { SupportedLanguage } from "@/lib/language";

function formatDate(value: string, language: SupportedLanguage) {
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatPercent(value: number | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

function formatMaybePercent(value: number | undefined) {
  return typeof value === "number" ? formatPercent(value) : "-";
}

function renderCountMap(value: Record<string, number> | undefined, copy: AdminTrainingHistoryCatalog) {
  if (!value || Object.keys(value).length === 0) {
    return "-";
  }
  return Object.entries(value)
    .map(([key, count]) => `${key} ${formatTrainingHistoryText(copy.countPattern, { count })}`)
    .join(" / ");
}

function formatTrainingEngine(item: AdminTrainingHistoryItem) {
  const nluType = normalizeNluType(item.nlu_type);
  return `${getNluTypeLabel(nluType)} / ${getNluModelLabel(nluType, item.nlu_model)}`;
}

function TrainingQualityDetail({ item, qualityCopy }: { item: AdminTrainingHistoryItem; qualityCopy: AdminTrainingHistoryCatalog }) {
  const diagnostics = item.data_json.quality_diagnostics;
  const summary = diagnostics?.summary ?? {};
  const settings = diagnostics?.settings ?? {};
  const rows = diagnostics?.items ?? [];
  const engineType = String(summary.engine_type ?? item.nlu_type ?? "").toLowerCase();

  if (engineType === "semantic") {
    return (
      <section className="admin-training-quality">
        <div className="admin-training-quality__header">
          <strong>{qualityCopy.semanticValidationTitle}</strong>
          <span>
            Index {settings.index_name || "-"} / Top-K {settings.top_k ?? 3}
          </span>
        </div>
        <div className="admin-training-quality__summary">
          <span>{qualityCopy.checked} {formatTrainingHistoryText(qualityCopy.countPattern, { count: summary.total_checked ?? 0 })}</span>
          <span>T {formatTrainingHistoryText(qualityCopy.countPattern, { count: summary.training_checked ?? 0 })}</span>
          <span>{qualityCopy.exact} {formatTrainingHistoryText(qualityCopy.countPattern, { count: summary.exact_match_count ?? 0 })}</span>
          <span>{qualityCopy.accuracy} {formatMaybePercent(summary.accuracy)}</span>
          <span>{qualityCopy.problemCandidates} {formatTrainingHistoryText(qualityCopy.countPattern, { count: summary.problem_count ?? rows.length })}</span>
        </div>
        <p className="admin-training-quality__meta">{qualityCopy.status}: {renderCountMap(summary.status_counts, qualityCopy)}</p>
        <p className="admin-training-quality__meta">{qualityCopy.cause}: {renderCountMap(summary.diagnosis_counts, qualityCopy)}</p>
        {rows.length === 0 ? (
          <p className="admin-page__empty">{qualityCopy.noSemanticCandidates}</p>
        ) : (
          <div className="admin-training-quality__list">
            {rows.slice(0, 30).map((row: AdminNluQualityDiagnosticItem) => (
              <div key={row.id} className="admin-training-quality__item">
                <span>{row.row_type ?? "T"}</span>
                <strong>{row.status ?? qualityCopy.issue}</strong>
                <b>{row.diagnosis_type ?? qualityCopy.semanticMismatch}</b>
                <p>{row.utterance}</p>
                <small>
                  {qualityCopy.expected}: {row.expected_name} / {qualityCopy.firstRank}: {row.predicted_name} {formatMaybePercent(row.top_score)} / {qualityCopy.secondRank}:{" "}
                  {row.second_name ?? "-"} {formatMaybePercent(row.second_score)}
                </small>
                <small>{qualityCopy.matchedSentence}: {row.features?.join(", ") || "-"}</small>
                <small>{row.reason || "-"}</small>
                <small>{row.recommendation || "-"}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="admin-training-quality">
      <div className="admin-training-quality__header">
        <strong>{qualityCopy.nluQualityTitle}</strong>
        <span>
          Cut-off {formatPercent((settings.score_cutoff ?? 0) * 100)} / {qualityCopy.similarIntent}{" "}
          {formatPercent((settings.similar_intent_score ?? 0) * 100)}
        </span>
      </div>
      <div className="admin-training-quality__summary">
        <span>{qualityCopy.checked} {formatTrainingHistoryText(qualityCopy.countPattern, { count: summary.total_checked ?? 0 })}</span>
        <span>T {formatTrainingHistoryText(qualityCopy.countPattern, { count: summary.training_checked ?? 0 })}</span>
        <span>V {formatTrainingHistoryText(qualityCopy.countPattern, { count: summary.validation_checked ?? 0 })}</span>
        <span>{qualityCopy.problemCandidates} {formatTrainingHistoryText(qualityCopy.countPattern, { count: summary.problem_count ?? rows.length })}</span>
      </div>
      <p className="admin-training-quality__meta">{qualityCopy.status}: {renderCountMap(summary.status_counts, qualityCopy)}</p>
      <p className="admin-training-quality__meta">{qualityCopy.cause}: {renderCountMap(summary.diagnosis_counts, qualityCopy)}</p>
      {rows.length === 0 ? (
        <p className="admin-page__empty">{qualityCopy.noCandidates}</p>
      ) : (
        <div className="admin-training-quality__list">
          {rows.slice(0, 30).map((row: AdminNluQualityDiagnosticItem) => (
            <div key={row.id} className="admin-training-quality__item">
              <span>{row.row_type}</span>
              <strong>{row.status}</strong>
              <b>{row.diagnosis_type}</b>
              <p>{row.utterance}</p>
              <small>
                {qualityCopy.expected}: {row.expected_name} {formatPercent(row.expected_score)} / {qualityCopy.firstRank}: {row.predicted_name}{" "}
                {formatPercent(row.top_score)} / {qualityCopy.secondRank}: {row.second_name} {formatPercent(row.second_score)}
              </small>
              <small>Features: {row.features?.join(", ") || "-"}</small>
              <small>{row.reason}</small>
              <small>{row.recommendation}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminTrainingHistoryPage() {
  const { language } = useI18n();
  const copy = ADMIN_PAGE_CATALOGS[language].trainingHistory;
  const qualityCopy = ADMIN_TRAINING_HISTORY_CATALOGS[language];
  const [selectedItem, setSelectedItem] = useState<AdminTrainingHistoryItem | null>(null);
  const fetchItems = useCallback((token: string) => fetchTrainingHistory(token), []);
  const buildRow = useCallback((item: AdminTrainingHistoryItem, index: number) => ({
    key: item.id,
    cells: [
      <input key={`check-${item.id}`} type="checkbox" aria-label={formatTrainingHistoryText(qualityCopy.selectRow, { index: index + 1 })} />,
      item.group_name,
      item.bot_name,
      String(item.version_no),
      formatTrainingEngine(item),
      item.training_status,
      item.user_login_id,
      formatDate(item.started_at, language),
      formatDate(item.completed_at, language),
      <button key={`detail-${item.id}`} type="button" className="admin-page__ghost admin-page__table-button" onClick={() => setSelectedItem(item)}>
        {copy.detail}
      </button>,
    ],
  }), [copy.detail, language, qualityCopy]);

  return (
    <>
      <AdminHistoryTablePage
        title={copy.title}
        searchPlaceholder={copy.searchPlaceholder}
        columns={[<input key="all" type="checkbox" aria-label={copy.columns[0]} />, ...copy.columns.slice(1)]}
        template="36px 96px 140px 52px minmax(170px, 0.9fr) 88px 92px 138px 138px 72px"
        fetchItems={fetchItems}
        buildRow={buildRow}
        filterColumns={{ group: 1, bot: 2, date: 7 }}
      />
      {selectedItem ? <TrainingQualityDetail item={selectedItem} qualityCopy={qualityCopy} /> : null}
    </>
  );
}
