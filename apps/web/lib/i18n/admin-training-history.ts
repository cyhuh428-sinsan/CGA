import type { SupportedLanguage } from "@/lib/language";

export type AdminTrainingHistoryCatalog = {
  selectRow: string;
  semanticValidationTitle: string;
  nluQualityTitle: string;
  checked: string;
  exact: string;
  accuracy: string;
  problemCandidates: string;
  status: string;
  cause: string;
  noSemanticCandidates: string;
  noCandidates: string;
  issue: string;
  semanticMismatch: string;
  expected: string;
  firstRank: string;
  secondRank: string;
  matchedSentence: string;
  similarIntent: string;
  countPattern: string;
};

export function formatTrainingHistoryText(pattern: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), pattern);
}

export const ADMIN_TRAINING_HISTORY_CATALOGS = {
  ko: {
    selectRow: "학습 이력 {index} 선택", semanticValidationTitle: "Semantic NLU 학습문장 자기검증", nluQualityTitle: "NLU 학습 품질 진단",
    checked: "점검", exact: "Exact", accuracy: "정확도", problemCandidates: "문제 후보", status: "상태", cause: "원인",
    noSemanticCandidates: "전체 학습 인덱스 자기검증에서 보완 후보가 없습니다.", noCandidates: "보완 후보가 없습니다.",
    issue: "문제", semanticMismatch: "Semantic 검색 불일치", expected: "기대", firstRank: "1순위", secondRank: "2순위",
    matchedSentence: "매칭 문장", similarIntent: "유사의도", countPattern: "{count}건",
  },
  en: {
    selectRow: "Select training history {index}", semanticValidationTitle: "Semantic NLU Training Sentence Validation", nluQualityTitle: "NLU Training Quality Diagnosis",
    checked: "Checked", exact: "Exact", accuracy: "Accuracy", problemCandidates: "Problem Candidates", status: "Status", cause: "Cause",
    noSemanticCandidates: "No improvement candidates were found in full-index validation.", noCandidates: "No improvement candidates.",
    issue: "Issue", semanticMismatch: "Semantic Search Mismatch", expected: "Expected", firstRank: "1st", secondRank: "2nd",
    matchedSentence: "Matched Sentence", similarIntent: "Similar Intent", countPattern: "{count}",
  },
  "zh-CN": {
    selectRow: "选择训练历史 {index}", semanticValidationTitle: "Semantic NLU 训练语句自检", nluQualityTitle: "NLU 训练质量诊断",
    checked: "已检查", exact: "精确匹配", accuracy: "准确率", problemCandidates: "问题候选", status: "状态", cause: "原因",
    noSemanticCandidates: "完整训练索引自检中没有需要改进的候选。", noCandidates: "没有需要改进的候选。",
    issue: "问题", semanticMismatch: "Semantic 搜索不匹配", expected: "预期", firstRank: "第1位", secondRank: "第2位",
    matchedSentence: "匹配语句", similarIntent: "相似意图", countPattern: "{count}条",
  },
  ja: {
    selectRow: "学習履歴 {index} を選択", semanticValidationTitle: "Semantic NLU 学習文自己検証", nluQualityTitle: "NLU 学習品質診断",
    checked: "点検", exact: "完全一致", accuracy: "精度", problemCandidates: "問題候補", status: "状態", cause: "原因",
    noSemanticCandidates: "全学習インデックスの自己検証で改善候補はありません。", noCandidates: "改善候補はありません。",
    issue: "問題", semanticMismatch: "Semantic検索不一致", expected: "期待", firstRank: "1位", secondRank: "2位",
    matchedSentence: "一致文", similarIntent: "類似インテント", countPattern: "{count}件",
  },
  vi: {
    selectRow: "Chọn lịch sử huấn luyện {index}", semanticValidationTitle: "Tự kiểm tra câu huấn luyện Semantic NLU", nluQualityTitle: "Chẩn đoán chất lượng huấn luyện NLU",
    checked: "Đã kiểm tra", exact: "Khớp chính xác", accuracy: "Độ chính xác", problemCandidates: "Ứng viên có vấn đề", status: "Trạng thái", cause: "Nguyên nhân",
    noSemanticCandidates: "Không có ứng viên cần cải thiện trong tự kiểm tra toàn bộ chỉ mục.", noCandidates: "Không có ứng viên cần cải thiện.",
    issue: "Vấn đề", semanticMismatch: "Tìm kiếm Semantic không khớp", expected: "Mong đợi", firstRank: "Hạng 1", secondRank: "Hạng 2",
    matchedSentence: "Câu khớp", similarIntent: "Ý định tương tự", countPattern: "{count}",
  },
  fr: {
    selectRow: "Sélectionner l’historique d’entraînement {index}", semanticValidationTitle: "Auto-validation des phrases Semantic NLU", nluQualityTitle: "Diagnostic qualité de l’entraînement NLU",
    checked: "Vérifiés", exact: "Exact", accuracy: "Précision", problemCandidates: "Candidats problématiques", status: "État", cause: "Cause",
    noSemanticCandidates: "Aucun candidat à améliorer dans l’auto-validation de l’index complet.", noCandidates: "Aucun candidat à améliorer.",
    issue: "Problème", semanticMismatch: "Écart de recherche Semantic", expected: "Attendu", firstRank: "1er", secondRank: "2e",
    matchedSentence: "Phrase correspondante", similarIntent: "Intention similaire", countPattern: "{count}",
  },
  de: {
    selectRow: "Trainingsverlauf {index} auswählen", semanticValidationTitle: "Semantic-NLU-Selbstprüfung der Trainingssätze", nluQualityTitle: "NLU-Trainingsqualitätsdiagnose",
    checked: "Geprüft", exact: "Exakt", accuracy: "Genauigkeit", problemCandidates: "Problemkandidaten", status: "Status", cause: "Ursache",
    noSemanticCandidates: "Bei der vollständigen Indexprüfung wurden keine Verbesserungskandidaten gefunden.", noCandidates: "Keine Verbesserungskandidaten.",
    issue: "Problem", semanticMismatch: "Abweichung bei der Semantic-Suche", expected: "Erwartet", firstRank: "1. Rang", secondRank: "2. Rang",
    matchedSentence: "Passender Satz", similarIntent: "Ähnlicher Intent", countPattern: "{count}",
  },
} satisfies Record<SupportedLanguage, AdminTrainingHistoryCatalog>;
