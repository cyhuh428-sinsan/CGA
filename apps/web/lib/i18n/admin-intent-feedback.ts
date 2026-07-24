import type { SupportedLanguage } from "@/lib/language";

export type AdminIntentFeedbackCatalog = {
  dialogTitle: string;
  diagnosisSummary: string;
  channel: string;
  averageScore: string;
  candidateCount: string;
  unclassified: string;
  lowScore: string;
  recommendedAction: string;
  minMaxScore: string;
  diagnosisReasons: string;
  noDiagnosisReasons: string;
  suggestedTrainingSentences: string;
  noSuggestedTrainingSentences: string;
  featureScoreDiagnosis: string;
  expected: string;
  firstRank: string;
  secondRank: string;
  noQualityDiagnostics: string;
  collectedUtterances: string;
  score: string;
  noCollectedUtterances: string;
  storedData: string;
  countPattern: string;
};

export function formatIntentFeedbackCount(pattern: string, count: number) {
  return pattern.replace("{count}", String(count));
}

export const ADMIN_INTENT_FEEDBACK_CATALOGS = {
  ko: {
    dialogTitle: "의도 피드백 상세", diagnosisSummary: "진단 요약", channel: "채널", averageScore: "평균 점수",
    candidateCount: "후보 건수", unclassified: "미분류", lowScore: "낮은 점수", recommendedAction: "권장 조치",
    minMaxScore: "최저/최고 점수", diagnosisReasons: "진단 사유", noDiagnosisReasons: "추가 진단 사유가 없습니다.",
    suggestedTrainingSentences: "추천 학습문장", noSuggestedTrainingSentences: "추천할 학습문장 후보가 없습니다.",
    featureScoreDiagnosis: "Feature/Score 진단", expected: "기대", firstRank: "1순위", secondRank: "2순위",
    noQualityDiagnostics: "연결된 학습 품질 진단 후보가 없습니다.", collectedUtterances: "수집 발화", score: "점수",
    noCollectedUtterances: "수집된 발화 샘플이 없습니다.", storedData: "저장 데이터", countPattern: "{count}건",
  },
  en: {
    dialogTitle: "Intent Feedback Details", diagnosisSummary: "Diagnosis Summary", channel: "Channel", averageScore: "Average Score",
    candidateCount: "Candidates", unclassified: "Unclassified", lowScore: "Low Score", recommendedAction: "Recommended Action",
    minMaxScore: "Minimum / Maximum Score", diagnosisReasons: "Diagnosis Reasons", noDiagnosisReasons: "No additional diagnosis reasons.",
    suggestedTrainingSentences: "Suggested Training Sentences", noSuggestedTrainingSentences: "No suggested training sentence candidates.",
    featureScoreDiagnosis: "Feature/Score Diagnosis", expected: "Expected", firstRank: "1st", secondRank: "2nd",
    noQualityDiagnostics: "No linked training quality diagnosis candidates.", collectedUtterances: "Collected Utterances", score: "Score",
    noCollectedUtterances: "No collected utterance samples.", storedData: "Stored Data", countPattern: "{count}",
  },
  "zh-CN": {
    dialogTitle: "意图反馈详情", diagnosisSummary: "诊断摘要", channel: "渠道", averageScore: "平均分",
    candidateCount: "候选数", unclassified: "未分类", lowScore: "低分", recommendedAction: "建议措施",
    minMaxScore: "最低/最高分", diagnosisReasons: "诊断原因", noDiagnosisReasons: "没有其他诊断原因。",
    suggestedTrainingSentences: "建议训练语句", noSuggestedTrainingSentences: "没有建议的训练语句候选。",
    featureScoreDiagnosis: "特征/分数诊断", expected: "预期", firstRank: "第1位", secondRank: "第2位",
    noQualityDiagnostics: "没有关联的训练质量诊断候选。", collectedUtterances: "收集的话语", score: "分数",
    noCollectedUtterances: "没有收集到话语样本。", storedData: "存储数据", countPattern: "{count}条",
  },
  ja: {
    dialogTitle: "インテントフィードバック詳細", diagnosisSummary: "診断概要", channel: "チャネル", averageScore: "平均スコア",
    candidateCount: "候補数", unclassified: "未分類", lowScore: "低スコア", recommendedAction: "推奨対応",
    minMaxScore: "最低/最高スコア", diagnosisReasons: "診断理由", noDiagnosisReasons: "追加の診断理由はありません。",
    suggestedTrainingSentences: "推奨学習文", noSuggestedTrainingSentences: "推奨する学習文候補はありません。",
    featureScoreDiagnosis: "Feature/Score診断", expected: "期待", firstRank: "1位", secondRank: "2位",
    noQualityDiagnostics: "関連する学習品質診断候補はありません。", collectedUtterances: "収集発話", score: "スコア",
    noCollectedUtterances: "収集された発話サンプルはありません。", storedData: "保存データ", countPattern: "{count}件",
  },
  vi: {
    dialogTitle: "Chi tiết phản hồi ý định", diagnosisSummary: "Tóm tắt chẩn đoán", channel: "Kênh", averageScore: "Điểm trung bình",
    candidateCount: "Số ứng viên", unclassified: "Chưa phân loại", lowScore: "Điểm thấp", recommendedAction: "Hành động đề xuất",
    minMaxScore: "Điểm thấp nhất / cao nhất", diagnosisReasons: "Lý do chẩn đoán", noDiagnosisReasons: "Không có lý do chẩn đoán bổ sung.",
    suggestedTrainingSentences: "Câu huấn luyện đề xuất", noSuggestedTrainingSentences: "Không có câu huấn luyện đề xuất.",
    featureScoreDiagnosis: "Chẩn đoán Feature/Score", expected: "Mong đợi", firstRank: "Hạng 1", secondRank: "Hạng 2",
    noQualityDiagnostics: "Không có ứng viên chẩn đoán chất lượng huấn luyện liên quan.", collectedUtterances: "Câu nói đã thu thập", score: "Điểm",
    noCollectedUtterances: "Không có mẫu câu nói đã thu thập.", storedData: "Dữ liệu đã lưu", countPattern: "{count}",
  },
  fr: {
    dialogTitle: "Détails du retour d’intention", diagnosisSummary: "Résumé du diagnostic", channel: "Canal", averageScore: "Score moyen",
    candidateCount: "Candidats", unclassified: "Non classé", lowScore: "Score faible", recommendedAction: "Action recommandée",
    minMaxScore: "Score minimum / maximum", diagnosisReasons: "Motifs du diagnostic", noDiagnosisReasons: "Aucun motif de diagnostic supplémentaire.",
    suggestedTrainingSentences: "Phrases d’entraînement suggérées", noSuggestedTrainingSentences: "Aucune phrase d’entraînement suggérée.",
    featureScoreDiagnosis: "Diagnostic Feature/Score", expected: "Attendu", firstRank: "1er", secondRank: "2e",
    noQualityDiagnostics: "Aucun candidat de diagnostic qualité associé.", collectedUtterances: "Énoncés collectés", score: "Score",
    noCollectedUtterances: "Aucun échantillon d’énoncé collecté.", storedData: "Données enregistrées", countPattern: "{count}",
  },
  de: {
    dialogTitle: "Intent-Feedback-Details", diagnosisSummary: "Diagnoseübersicht", channel: "Kanal", averageScore: "Durchschnitt",
    candidateCount: "Kandidaten", unclassified: "Unklassifiziert", lowScore: "Niedrige Bewertung", recommendedAction: "Empfohlene Maßnahme",
    minMaxScore: "Niedrigste / höchste Bewertung", diagnosisReasons: "Diagnosegründe", noDiagnosisReasons: "Keine weiteren Diagnosegründe.",
    suggestedTrainingSentences: "Vorgeschlagene Trainingssätze", noSuggestedTrainingSentences: "Keine vorgeschlagenen Trainingssätze.",
    featureScoreDiagnosis: "Feature/Score-Diagnose", expected: "Erwartet", firstRank: "1. Rang", secondRank: "2. Rang",
    noQualityDiagnostics: "Keine verknüpften Qualitätsdiagnose-Kandidaten.", collectedUtterances: "Erfasste Äußerungen", score: "Bewertung",
    noCollectedUtterances: "Keine erfassten Äußerungsbeispiele.", storedData: "Gespeicherte Daten", countPattern: "{count}",
  },
} satisfies Record<SupportedLanguage, AdminIntentFeedbackCatalog>;
