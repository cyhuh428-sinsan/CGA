"use client";

import { useCallback, useState } from "react";

import { AdminHistoryTablePage } from "@/components/admin-history-table-page";
import {
  fetchTrainingHistory,
  type AdminNluQualityDiagnosticItem,
  type AdminTrainingHistoryItem,
} from "@/lib/admin-api";
import { getNluModelLabel, getNluTypeLabel, normalizeNluType } from "@/lib/nlu-options";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
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

function renderCountMap(value?: Record<string, number>) {
  if (!value || Object.keys(value).length === 0) {
    return "-";
  }
  return Object.entries(value)
    .map(([key, count]) => `${key} ${count}건`)
    .join(" / ");
}

function formatTrainingEngine(item: AdminTrainingHistoryItem) {
  const nluType = normalizeNluType(item.nlu_type);
  return `${getNluTypeLabel(nluType)} / ${getNluModelLabel(nluType, item.nlu_model)}`;
}

function TrainingQualityDetail({ item }: { item: AdminTrainingHistoryItem }) {
  const diagnostics = item.data_json.quality_diagnostics;
  const summary = diagnostics?.summary ?? {};
  const settings = diagnostics?.settings ?? {};
  const rows = diagnostics?.items ?? [];
  const engineType = String(summary.engine_type ?? item.nlu_type ?? "").toLowerCase();

  if (engineType === "semantic") {
    return (
      <section className="admin-training-quality">
        <div className="admin-training-quality__header">
          <strong>Semantic NLU 학습문장 자기검증</strong>
          <span>
            Index {settings.index_name || "-"} / Top-K {settings.top_k ?? 3}
          </span>
        </div>
        <div className="admin-training-quality__summary">
          <span>점검 {summary.total_checked ?? 0}건</span>
          <span>T {summary.training_checked ?? 0}건</span>
          <span>Exact {summary.exact_match_count ?? 0}건</span>
          <span>정확도 {formatMaybePercent(summary.accuracy)}</span>
          <span>문제 후보 {summary.problem_count ?? rows.length}건</span>
        </div>
        <p className="admin-training-quality__meta">상태: {renderCountMap(summary.status_counts)}</p>
        <p className="admin-training-quality__meta">원인: {renderCountMap(summary.diagnosis_counts)}</p>
        {rows.length === 0 ? (
          <p className="admin-page__empty">전체 학습 인덱스 자기검증에서 보완 후보가 없습니다.</p>
        ) : (
          <div className="admin-training-quality__list">
            {rows.slice(0, 30).map((row: AdminNluQualityDiagnosticItem) => (
              <div key={row.id} className="admin-training-quality__item">
                <span>{row.row_type ?? "T"}</span>
                <strong>{row.status ?? "문제"}</strong>
                <b>{row.diagnosis_type ?? "Semantic 검색 불일치"}</b>
                <p>{row.utterance}</p>
                <small>
                  기대: {row.expected_name} / 1순위: {row.predicted_name} {formatMaybePercent(row.top_score)} / 2순위:{" "}
                  {row.second_name ?? "-"} {formatMaybePercent(row.second_score)}
                </small>
                <small>매칭 문장: {row.features?.join(", ") || "-"}</small>
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
        <strong>NLU 학습 품질 진단</strong>
        <span>
          Cut-off {formatPercent((settings.score_cutoff ?? 0) * 100)} / 유사의도{" "}
          {formatPercent((settings.similar_intent_score ?? 0) * 100)}
        </span>
      </div>
      <div className="admin-training-quality__summary">
        <span>점검 {summary.total_checked ?? 0}건</span>
        <span>T {summary.training_checked ?? 0}건</span>
        <span>V {summary.validation_checked ?? 0}건</span>
        <span>문제 후보 {summary.problem_count ?? rows.length}건</span>
      </div>
      <p className="admin-training-quality__meta">상태: {renderCountMap(summary.status_counts)}</p>
      <p className="admin-training-quality__meta">원인: {renderCountMap(summary.diagnosis_counts)}</p>
      {rows.length === 0 ? (
        <p className="admin-page__empty">보완 후보가 없습니다.</p>
      ) : (
        <div className="admin-training-quality__list">
          {rows.slice(0, 30).map((row: AdminNluQualityDiagnosticItem) => (
            <div key={row.id} className="admin-training-quality__item">
              <span>{row.row_type}</span>
              <strong>{row.status}</strong>
              <b>{row.diagnosis_type}</b>
              <p>{row.utterance}</p>
              <small>
                기대: {row.expected_name} {formatPercent(row.expected_score)} / 1순위: {row.predicted_name}{" "}
                {formatPercent(row.top_score)} / 2순위: {row.second_name} {formatPercent(row.second_score)}
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
  const [selectedItem, setSelectedItem] = useState<AdminTrainingHistoryItem | null>(null);
  const fetchItems = useCallback((token: string) => fetchTrainingHistory(token), []);
  const buildRow = useCallback((item: AdminTrainingHistoryItem, index: number) => ({
    key: item.id,
    cells: [
      <input key={`check-${item.id}`} type="checkbox" aria-label={`학습 이력 ${index + 1} 선택`} />,
      item.group_name,
      item.bot_name,
      String(item.version_no),
      formatTrainingEngine(item),
      item.training_status,
      item.user_login_id,
      formatDate(item.started_at),
      formatDate(item.completed_at),
      <button key={`detail-${item.id}`} type="button" className="admin-page__ghost admin-page__table-button" onClick={() => setSelectedItem(item)}>
        상세
      </button>,
    ],
  }), []);

  return (
    <>
      <AdminHistoryTablePage
        title="학습 이력 조회"
        searchPlaceholder="봇 이름을 검색하세요."
        columns={[
          <input key="all" type="checkbox" aria-label="전체 선택" />,
          "그룹",
          "봇",
          "버전",
          "학습 엔진",
          "학습상태",
          "사용자",
          "학습 시작 시간",
          "학습 완료 시간",
          "상세",
        ]}
        template="36px 96px 140px 52px minmax(170px, 0.9fr) 88px 92px 138px 138px 72px"
        fetchItems={fetchItems}
        buildRow={buildRow}
        filterColumns={{ group: 1, bot: 2, date: 7 }}
      />
      {selectedItem ? <TrainingQualityDetail item={selectedItem} /> : null}
    </>
  );
}
