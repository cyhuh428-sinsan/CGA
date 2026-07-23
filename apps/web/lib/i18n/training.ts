import type { SupportedLanguage } from "@/lib/language";

export type TrainingCatalog = {
  loginRequired: string;
  ragTraining: string;
  nluTraining: string;
  queued: string;
  processing: string;
  error: string;
  training: string;
  train: string;
  completed: string;
  completedAt: string;
  answerDocuments: string;
  intentSentences: string;
  entities: string;
  vocabulary: string;
  botHub: string;
  voiceType: string;
  textType: string;
  answer: string;
  trained: string;
  untrained: string;
};

export const TRAINING_CATALOGS = {
  ko: { loginRequired: "로그인이 필요합니다.", ragTraining: "구성에서 확정한 RAG 의도와 답변 문서 기준으로 NLU 학습 중입니다.", nluTraining: "NLU 학습 중입니다.", queued: "NLU 학습 요청이 Queue에 등록되었습니다.", processing: "NLU 학습 작업을 처리하고 있습니다.", error: "학습 중 오류가 발생했습니다.", training: "학습중", train: "학습하기", completed: "학습이 완료되었습니다.", completedAt: "학습완료", answerDocuments: "답변문서", intentSentences: "의도문장", entities: "개체", vocabulary: "어휘", botHub: "봇 허브", voiceType: "보이스형", textType: "텍스트형", answer: "답변", trained: "학습성공", untrained: "미학습" },
  en: { loginRequired: "Sign-in is required.", ragTraining: "Training NLU with the confirmed RAG intents and answer documents.", nluTraining: "Training NLU.", queued: "The NLU training request was added to the queue.", processing: "Processing the NLU training job.", error: "An error occurred during training.", training: "Training", train: "Train", completed: "Training is complete.", completedAt: "Training completed", answerDocuments: "Answer documents", intentSentences: "Intent sentences", entities: "Entities", vocabulary: "Vocabulary", botHub: "Bot Hub", voiceType: "Voice", textType: "Text", answer: "Answer", trained: "Training succeeded", untrained: "Not trained" },
  "zh-CN": { loginRequired: "需要登录。", ragTraining: "正在根据已确认的 RAG 意图和回答文档训练 NLU。", nluTraining: "正在训练 NLU。", queued: "NLU 训练请求已加入队列。", processing: "正在处理 NLU 训练任务。", error: "训练过程中发生错误。", training: "训练中", train: "训练", completed: "训练已完成。", completedAt: "训练完成", answerDocuments: "回答文档", intentSentences: "意图语句", entities: "实体", vocabulary: "词汇", botHub: "Bot Hub", voiceType: "语音型", textType: "文本型", answer: "回答", trained: "训练成功", untrained: "未训练" },
  ja: { loginRequired: "ログインが必要です。", ragTraining: "確定したRAG意図と回答文書を基準にNLUを学習しています。", nluTraining: "NLUを学習しています。", queued: "NLU学習リクエストがキューに登録されました。", processing: "NLU学習ジョブを処理しています。", error: "学習中にエラーが発生しました。", training: "学習中", train: "学習する", completed: "学習が完了しました。", completedAt: "学習完了", answerDocuments: "回答文書", intentSentences: "意図文", entities: "エンティティ", vocabulary: "語彙", botHub: "Bot Hub", voiceType: "音声型", textType: "テキスト型", answer: "回答", trained: "学習成功", untrained: "未学習" },
  vi: { loginRequired: "Cần đăng nhập.", ragTraining: "Đang huấn luyện NLU theo ý định RAG và tài liệu trả lời đã xác nhận.", nluTraining: "Đang huấn luyện NLU.", queued: "Yêu cầu huấn luyện NLU đã được thêm vào hàng đợi.", processing: "Đang xử lý tác vụ huấn luyện NLU.", error: "Đã xảy ra lỗi khi huấn luyện.", training: "Đang huấn luyện", train: "Huấn luyện", completed: "Huấn luyện đã hoàn tất.", completedAt: "Hoàn tất huấn luyện", answerDocuments: "Tài liệu trả lời", intentSentences: "Câu ý định", entities: "Thực thể", vocabulary: "Từ vựng", botHub: "Bot Hub", voiceType: "Giọng nói", textType: "Văn bản", answer: "Trả lời", trained: "Huấn luyện thành công", untrained: "Chưa huấn luyện" },
  fr: { loginRequired: "La connexion est requise.", ragTraining: "Entraînement NLU selon les intentions RAG et les documents de réponse confirmés.", nluTraining: "Entraînement NLU en cours.", queued: "La demande d'entraînement NLU a été ajoutée à la file.", processing: "Traitement de la tâche d'entraînement NLU.", error: "Une erreur est survenue pendant l'entraînement.", training: "Entraînement", train: "Entraîner", completed: "L'entraînement est terminé.", completedAt: "Entraînement terminé", answerDocuments: "Documents de réponse", intentSentences: "Phrases d'intention", entities: "Entités", vocabulary: "Vocabulaire", botHub: "Bot Hub", voiceType: "Vocal", textType: "Texte", answer: "Réponse", trained: "Entraînement réussi", untrained: "Non entraîné" },
  de: { loginRequired: "Eine Anmeldung ist erforderlich.", ragTraining: "NLU-Training mit den bestätigten RAG-Intents und Antwortdokumenten.", nluTraining: "NLU-Training läuft.", queued: "Die NLU-Trainingsanfrage wurde zur Warteschlange hinzugefügt.", processing: "Der NLU-Trainingsauftrag wird verarbeitet.", error: "Beim Training ist ein Fehler aufgetreten.", training: "Training", train: "Trainieren", completed: "Das Training ist abgeschlossen.", completedAt: "Training abgeschlossen", answerDocuments: "Antwortdokumente", intentSentences: "Intent-Sätze", entities: "Entitäten", vocabulary: "Vokabular", botHub: "Bot Hub", voiceType: "Sprache", textType: "Text", answer: "Antwort", trained: "Training erfolgreich", untrained: "Nicht trainiert" },
} satisfies Record<SupportedLanguage, TrainingCatalog>;
