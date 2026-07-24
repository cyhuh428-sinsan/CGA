"use client";

import { useCallback, useState } from "react";

import { AdminHistoryTablePage } from "@/components/admin-history-table-page";
import { fetchIntentFeedback, type AdminIntentFeedbackItem } from "@/lib/admin-api";
import { useI18n } from "@/components/language-provider";
import { ADMIN_PAGE_CATALOGS } from "@/lib/i18n/admin-pages";
import { ADMIN_COMMON_CATALOGS, formatAdminText } from "@/lib/i18n/admin-common";
import { ADMIN_INTENT_FEEDBACK_CATALOGS, formatIntentFeedbackCount } from "@/lib/i18n/admin-intent-feedback";
import type { AdminIntentFeedbackCatalog } from "@/lib/i18n/admin-intent-feedback";

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function feedbackLabel(item: AdminIntentFeedbackItem, copy: AdminIntentFeedbackCatalog) {
  const fallbackCount = Number(item.data_json.fallback_count || 0);
  const lowScoreCount = Number(item.data_json.low_score_count || 0);
  if (fallbackCount > 0) return `${copy.unclassified} ${formatIntentFeedbackCount(copy.countPattern, fallbackCount)}`;
  if (lowScoreCount > 0) return `${copy.lowScore} ${formatIntentFeedbackCount(copy.countPattern, lowScoreCount)}`;
  return "-";
}

function buildFeedbackSearchText(item: AdminIntentFeedbackItem) {
  return [
    item.group_name,
    item.bot_name,
    item.channel_name,
    item.intent_name,
    ...asStringArray(item.data_json.suggested_training_sentences),
    ...asStringArray(item.data_json.diagnosis_reasons),
    formatJson(item.data_json.samples),
    formatJson(item.data_json.related_quality_diagnostics),
  ].join(" ");
}

export default function AdminIntentFeedbackPage() {
  const { language } = useI18n();
  const copy = ADMIN_PAGE_CATALOGS[language].intentFeedback;
  const commonCopy = ADMIN_COMMON_CATALOGS[language];
  const detailCopy = ADMIN_INTENT_FEEDBACK_CATALOGS[language];
  const [selectedItem, setSelectedItem] = useState<AdminIntentFeedbackItem | null>(null);
  const fetchItems = useCallback((token: string) => fetchIntentFeedback(token), []);
  const buildRow = useCallback((item: AdminIntentFeedbackItem) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__link-button" onClick={() => setSelectedItem(item)}>
        {copy.detail}
      </button>,
      item.group_name,
      item.bot_name,
      String(item.version_no || "-"),
      item.channel_name,
      item.intent_name,
      `${item.average_score.toFixed(2)}%`,
      String(item.feedback_count),
      feedbackLabel(item, detailCopy),
    ],
    searchText: buildFeedbackSearchText(item),
  }), [copy.detail, detailCopy]);
  const selectedSamples = selectedItem ? asRecordArray(selectedItem.data_json.samples) : [];
  const suggestedSentences = selectedItem ? asStringArray(selectedItem.data_json.suggested_training_sentences) : [];
  const diagnosisReasons = selectedItem ? asStringArray(selectedItem.data_json.diagnosis_reasons) : [];
  const relatedQualityDiagnostics = selectedItem ? asRecordArray(selectedItem.data_json.related_quality_diagnostics) : [];
  const scoreDistribution = selectedItem?.data_json.score_distribution && typeof selectedItem.data_json.score_distribution === "object" && !Array.isArray(selectedItem.data_json.score_distribution)
    ? selectedItem.data_json.score_distribution as Record<string, unknown>
    : {};

  return (
    <>
      <AdminHistoryTablePage
        title={copy.title}
        searchPlaceholder={copy.searchPlaceholder}
        pageSizeText={formatAdminText(commonCopy.pageSize, { count: 20 })}
        columns={copy.columns}
        template="64px 150px 180px 80px 120px 180px 120px 110px minmax(180px, 1fr)"
        fetchItems={fetchItems}
        buildRow={buildRow}
        filterColumns={{ group: 1, bot: 2, channel: 4 }}
        emptyText={copy.empty}
      />
      {selectedItem ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedItem(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label={detailCopy.dialogTitle}>
            <header className="admin-log-detail__header">
              <div>
                <strong>{detailCopy.dialogTitle}</strong>
                <p>{selectedItem.bot_name} / {selectedItem.intent_name}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedItem(null)} aria-label={copy.close}>
                ×
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>{detailCopy.diagnosisSummary}</h3>
                <dl className="admin-log-detail__summary">
                  <div><dt>{detailCopy.channel}</dt><dd>{selectedItem.channel_name}</dd></div>
                  <div><dt>{detailCopy.averageScore}</dt><dd>{selectedItem.average_score.toFixed(2)}%</dd></div>
                  <div><dt>{detailCopy.candidateCount}</dt><dd>{selectedItem.feedback_count}</dd></div>
                  <div><dt>{detailCopy.unclassified}</dt><dd>{String(selectedItem.data_json.fallback_count || 0)}</dd></div>
                  <div><dt>{detailCopy.lowScore}</dt><dd>{String(selectedItem.data_json.low_score_count || 0)}</dd></div>
                  <div><dt>{detailCopy.recommendedAction}</dt><dd>{String(selectedItem.data_json.recommendation || "-")}</dd></div>
                  <div><dt>{detailCopy.minMaxScore}</dt><dd>{String(scoreDistribution.min ?? "0")} / {String(scoreDistribution.max ?? "0")}%</dd></div>
                </dl>
              </section>
              <section className="admin-log-detail__section">
                <h3>{detailCopy.diagnosisReasons}</h3>
                {diagnosisReasons.length > 0 ? (
                  <ul className="admin-log-detail__events">
                    {diagnosisReasons.map((reason, index) => (
                      <li key={`${selectedItem.id}-reason-${index}`} className="admin-log-detail__event is-warning">
                        <p>{reason}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-log-detail__empty">{detailCopy.noDiagnosisReasons}</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>{detailCopy.suggestedTrainingSentences}</h3>
                {suggestedSentences.length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {suggestedSentences.map((sentence, index) => (
                      <li key={`${selectedItem.id}-sentence-${index}`} className="admin-log-detail__event">
                        <p>{sentence}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">{detailCopy.noSuggestedTrainingSentences}</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>{detailCopy.featureScoreDiagnosis}</h3>
                {relatedQualityDiagnostics.length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {relatedQualityDiagnostics.map((row, index) => (
                      <li key={`${selectedItem.id}-quality-${index}`} className="admin-log-detail__event is-warning">
                        <div>
                          <strong>{String(row.status || "-")} / {String(row.diagnosis_type || "-")}</strong>
                          <span>{String(row.row_type || "-")}</span>
                        </div>
                        <p>{String(row.utterance || "-")}</p>
                        <p>
                          {detailCopy.expected} {String(row.expected_name || "-")} {String(row.expected_score ?? "0")}%
                          {" / "}
                          {detailCopy.firstRank} {String(row.predicted_name || "-")} {String(row.top_score ?? "0")}%
                          {" / "}
                          {detailCopy.secondRank} {String(row.second_name || "-")} {String(row.second_score ?? "0")}%
                        </p>
                        <p>Features: {asStringArray(row.features).join(", ") || "-"}</p>
                        <p>{String(row.reason || "-")}</p>
                        <p>{String(row.recommendation || "-")}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">{detailCopy.noQualityDiagnostics}</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>{detailCopy.collectedUtterances}</h3>
                {selectedSamples.length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {selectedSamples.map((sample, index) => (
                      <li key={`${selectedItem.id}-${index}`} className="admin-log-detail__event is-warning">
                        <div>
                          <strong>{String(sample.utterance || "-")}</strong>
                          <span>{String(sample.occurred_at || "-")}</span>
                        </div>
                        <p>{detailCopy.score} {String(sample.score ?? "-")}% / {String(sample.event || "-")}</p>
                        <pre>{formatJson(sample.runtime_event)}</pre>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">{detailCopy.noCollectedUtterances}</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>{detailCopy.storedData}</h3>
                <pre>{formatJson(selectedItem.data_json)}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
