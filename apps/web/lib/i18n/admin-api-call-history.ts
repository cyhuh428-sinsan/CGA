import type { SupportedLanguage } from "@/lib/language";

export type AdminApiCallHistoryCatalog = {
  dialogTitle: string;
  summary: string;
  channel: string;
  responseCode: string;
  elapsedTime: string;
  detail: string;
  location: string;
  completionReason: string;
  dialogEnded: string;
  sessionEnded: string;
  yes: string;
  no: string;
  viewQueueHistory: string;
  viewConversationHistory: string;
  requestData: string;
  responseData: string;
  runtimeEvent: string;
  storedData: string;
};

export const ADMIN_API_CALL_HISTORY_CATALOGS = {
  ko: {
    dialogTitle: "API 호출 상세 이력", summary: "요약", channel: "채널", responseCode: "응답코드",
    elapsedTime: "소요시간", detail: "상세", location: "발생 위치", completionReason: "완료 사유",
    dialogEnded: "대화 종료", sessionEnded: "세션 종료", yes: "예", no: "아니오",
    viewQueueHistory: "Queue 이력에서 보기", viewConversationHistory: "대화 이력에서 보기",
    requestData: "요청 데이터", responseData: "응답 데이터", runtimeEvent: "런타임 이벤트", storedData: "저장 데이터",
  },
  en: {
    dialogTitle: "API Call Details", summary: "Summary", channel: "Channel", responseCode: "Response Code",
    elapsedTime: "Elapsed Time", detail: "Details", location: "Location", completionReason: "Completion Reason",
    dialogEnded: "Dialog Ended", sessionEnded: "Session Ended", yes: "Yes", no: "No",
    viewQueueHistory: "View in Queue History", viewConversationHistory: "View in Conversation History",
    requestData: "Request Data", responseData: "Response Data", runtimeEvent: "Runtime Event", storedData: "Stored Data",
  },
  "zh-CN": {
    dialogTitle: "API 调用详情", summary: "摘要", channel: "渠道", responseCode: "响应代码",
    elapsedTime: "耗时", detail: "详情", location: "发生位置", completionReason: "完成原因",
    dialogEnded: "对话已结束", sessionEnded: "会话已结束", yes: "是", no: "否",
    viewQueueHistory: "在队列历史中查看", viewConversationHistory: "在对话历史中查看",
    requestData: "请求数据", responseData: "响应数据", runtimeEvent: "运行时事件", storedData: "存储数据",
  },
  ja: {
    dialogTitle: "API 呼び出し詳細", summary: "概要", channel: "チャネル", responseCode: "応答コード",
    elapsedTime: "所要時間", detail: "詳細", location: "発生箇所", completionReason: "完了理由",
    dialogEnded: "対話終了", sessionEnded: "セッション終了", yes: "はい", no: "いいえ",
    viewQueueHistory: "Queue履歴で表示", viewConversationHistory: "対話履歴で表示",
    requestData: "リクエストデータ", responseData: "レスポンスデータ", runtimeEvent: "ランタイムイベント", storedData: "保存データ",
  },
  vi: {
    dialogTitle: "Chi tiết cuộc gọi API", summary: "Tóm tắt", channel: "Kênh", responseCode: "Mã phản hồi",
    elapsedTime: "Thời gian xử lý", detail: "Chi tiết", location: "Vị trí phát sinh", completionReason: "Lý do hoàn tất",
    dialogEnded: "Đã kết thúc hội thoại", sessionEnded: "Đã kết thúc phiên", yes: "Có", no: "Không",
    viewQueueHistory: "Xem trong lịch sử Queue", viewConversationHistory: "Xem trong lịch sử hội thoại",
    requestData: "Dữ liệu yêu cầu", responseData: "Dữ liệu phản hồi", runtimeEvent: "Sự kiện runtime", storedData: "Dữ liệu đã lưu",
  },
  fr: {
    dialogTitle: "Détails de l’appel API", summary: "Résumé", channel: "Canal", responseCode: "Code de réponse",
    elapsedTime: "Durée", detail: "Détails", location: "Emplacement", completionReason: "Motif d’achèvement",
    dialogEnded: "Dialogue terminé", sessionEnded: "Session terminée", yes: "Oui", no: "Non",
    viewQueueHistory: "Voir dans l’historique Queue", viewConversationHistory: "Voir dans l’historique des conversations",
    requestData: "Données de requête", responseData: "Données de réponse", runtimeEvent: "Événement runtime", storedData: "Données enregistrées",
  },
  de: {
    dialogTitle: "API-Aufrufdetails", summary: "Zusammenfassung", channel: "Kanal", responseCode: "Antwortcode",
    elapsedTime: "Dauer", detail: "Details", location: "Ort", completionReason: "Abschlussgrund",
    dialogEnded: "Dialog beendet", sessionEnded: "Sitzung beendet", yes: "Ja", no: "Nein",
    viewQueueHistory: "Im Queue-Verlauf anzeigen", viewConversationHistory: "Im Gesprächsverlauf anzeigen",
    requestData: "Anfragedaten", responseData: "Antwortdaten", runtimeEvent: "Laufzeitereignis", storedData: "Gespeicherte Daten",
  },
} satisfies Record<SupportedLanguage, AdminApiCallHistoryCatalog>;
