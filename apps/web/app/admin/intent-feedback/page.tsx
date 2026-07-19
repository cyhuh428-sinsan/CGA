"use client";

import { useCallback, useState } from "react";

import { AdminHistoryTablePage } from "@/components/admin-history-table-page";
import { fetchIntentFeedback, type AdminIntentFeedbackItem } from "@/lib/admin-api";

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function feedbackLabel(item: AdminIntentFeedbackItem) {
  const fallbackCount = Number(item.data_json.fallback_count || 0);
  const lowScoreCount = Number(item.data_json.low_score_count || 0);
  if (fallbackCount > 0) return `미분류 ${fallbackCount}건`;
  if (lowScoreCount > 0) return `낮은 점수 ${lowScoreCount}건`;
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
  const [selectedItem, setSelectedItem] = useState<AdminIntentFeedbackItem | null>(null);
  const fetchItems = useCallback((token: string) => fetchIntentFeedback(token), []);
  const buildRow = useCallback((item: AdminIntentFeedbackItem) => ({
    key: item.id,
    cells: [
      <button key="detail" type="button" className="admin-page__link-button" onClick={() => setSelectedItem(item)}>
        상세
      </button>,
      item.group_name,
      item.bot_name,
      String(item.version_no || "-"),
      item.channel_name,
      item.intent_name,
      `${item.average_score.toFixed(2)}%`,
      String(item.feedback_count),
      feedbackLabel(item),
    ],
    searchText: buildFeedbackSearchText(item),
  }), []);
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
        title="의도별 피드백 조회"
        searchPlaceholder="의도명, 봇명, 발화를 검색하세요."
        pageSizeText="20개씩 보기"
        columns={["", "그룹", "봇", "버전", "채널", "의도명", "평균 점수", "후보 건수", "진단"]}
        template="64px 150px 180px 80px 120px 180px 120px 110px minmax(180px, 1fr)"
        fetchItems={fetchItems}
        buildRow={buildRow}
        filterColumns={{ group: 1, bot: 2, channel: 4 }}
        emptyText="미분류 또는 낮은 점수로 수집된 의도 피드백 후보가 없습니다."
      />
      {selectedItem ? (
        <>
          <div className="admin-log-detail__scrim" onClick={() => setSelectedItem(null)} />
          <section className="admin-log-detail" role="dialog" aria-modal="true" aria-label="의도 피드백 상세">
            <header className="admin-log-detail__header">
              <div>
                <strong>의도 피드백 상세</strong>
                <p>{selectedItem.bot_name} / {selectedItem.intent_name}</p>
              </div>
              <button type="button" className="admin-log-detail__close" onClick={() => setSelectedItem(null)} aria-label="닫기">
                ×
              </button>
            </header>
            <div className="admin-log-detail__body">
              <section className="admin-log-detail__section">
                <h3>진단 요약</h3>
                <dl className="admin-log-detail__summary">
                  <div><dt>채널</dt><dd>{selectedItem.channel_name}</dd></div>
                  <div><dt>평균 점수</dt><dd>{selectedItem.average_score.toFixed(2)}%</dd></div>
                  <div><dt>후보 건수</dt><dd>{selectedItem.feedback_count}</dd></div>
                  <div><dt>미분류</dt><dd>{String(selectedItem.data_json.fallback_count || 0)}</dd></div>
                  <div><dt>낮은 점수</dt><dd>{String(selectedItem.data_json.low_score_count || 0)}</dd></div>
                  <div><dt>권장 조치</dt><dd>{String(selectedItem.data_json.recommendation || "-")}</dd></div>
                  <div><dt>최저/최고 점수</dt><dd>{String(scoreDistribution.min ?? "0")} / {String(scoreDistribution.max ?? "0")}%</dd></div>
                </dl>
              </section>
              <section className="admin-log-detail__section">
                <h3>진단 사유</h3>
                {diagnosisReasons.length > 0 ? (
                  <ul className="admin-log-detail__events">
                    {diagnosisReasons.map((reason, index) => (
                      <li key={`${selectedItem.id}-reason-${index}`} className="admin-log-detail__event is-warning">
                        <p>{reason}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-log-detail__empty">추가 진단 사유가 없습니다.</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>추천 학습문장</h3>
                {suggestedSentences.length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {suggestedSentences.map((sentence, index) => (
                      <li key={`${selectedItem.id}-sentence-${index}`} className="admin-log-detail__event">
                        <p>{sentence}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">추천할 학습문장 후보가 없습니다.</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>Feature/Score 진단</h3>
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
                          기대 {String(row.expected_name || "-")} {String(row.expected_score ?? "0")}%
                          {" / "}
                          1순위 {String(row.predicted_name || "-")} {String(row.top_score ?? "0")}%
                          {" / "}
                          2순위 {String(row.second_name || "-")} {String(row.second_score ?? "0")}%
                        </p>
                        <p>Features: {asStringArray(row.features).join(", ") || "-"}</p>
                        <p>{String(row.reason || "-")}</p>
                        <p>{String(row.recommendation || "-")}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">연결된 학습 품질 진단 후보가 없습니다.</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>수집 발화</h3>
                {selectedSamples.length > 0 ? (
                  <ol className="admin-log-detail__events">
                    {selectedSamples.map((sample, index) => (
                      <li key={`${selectedItem.id}-${index}`} className="admin-log-detail__event is-warning">
                        <div>
                          <strong>{String(sample.utterance || "-")}</strong>
                          <span>{String(sample.occurred_at || "-")}</span>
                        </div>
                        <p>점수 {String(sample.score ?? "-")}% / {String(sample.event || "-")}</p>
                        <pre>{formatJson(sample.runtime_event)}</pre>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-log-detail__empty">수집된 발화 샘플이 없습니다.</p>
                )}
              </section>
              <section className="admin-log-detail__section">
                <h3>저장 데이터</h3>
                <pre>{formatJson(selectedItem.data_json)}</pre>
              </section>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
