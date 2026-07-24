import type { SupportedLanguage } from "@/lib/language";

export type AdminNavigationCatalog = {
  systemAdministration: string;
  userManagementGroup: string;
  userManagement: string;
  loginHistory: string;
  groupManagement: string;
  statusGroup: string;
  auditLogs: string;
  botStatus: string;
  trainingHistory: string;
  conversationHistory: string;
  apiCallHistory: string;
  queueHistory: string;
  intentFeedback: string;
  conversationGroup: string;
  commonVariables: string;
  defaultMessages: string;
  integrationGroup: string;
  channels: string;
  botstationStatus: string;
  otherGroup: string;
  templates: string;
  license: string;
  licenseNotApplied: string;
  licenseChecking: string;
  licenseCheckFailed: string;
  expired: string;
  verifying: string;
};

export type AdminNavigationGroup = {
  key: "users" | "status" | "conversation" | "integration" | "other";
  title: string;
  items: Array<{ href: string; label: string }>;
};

export const ADMIN_NAVIGATION_CATALOGS = {
  ko: {
    systemAdministration: "CGA Studio 시스템 관리", userManagementGroup: "사용자 관리", userManagement: "사용자 관리",
    loginHistory: "로그인 이력", groupManagement: "그룹 관리", statusGroup: "현황 조회", auditLogs: "운영/시스템 로그 조회",
    botStatus: "봇 현황 조회", trainingHistory: "학습 이력 조회", conversationHistory: "대화 이력 조회",
    apiCallHistory: "API 호출 이력 조회", queueHistory: "Queue 이력 조회", intentFeedback: "의도별 피드백 조회",
    conversationGroup: "대화 관리", commonVariables: "공통 변수 관리하기", defaultMessages: "기본 메시지 관리",
    integrationGroup: "시스템 연계", channels: "채널 관리", botstationStatus: "봇스테이션 연계 현황",
    otherGroup: "기타 관리", templates: "템플릿 목록", license: "라이선스 조회", licenseNotApplied: "라이선스 미적용",
    licenseChecking: "라이선스 확인 중", licenseCheckFailed: "라이선스 확인 실패", expired: "만료", verifying: "확인 중입니다...",
  },
  en: {
    systemAdministration: "CGA Studio System Administration", userManagementGroup: "User Management", userManagement: "Users",
    loginHistory: "Login History", groupManagement: "Groups", statusGroup: "Status", auditLogs: "Operations / System Logs",
    botStatus: "Bot Status", trainingHistory: "Training History", conversationHistory: "Conversation History",
    apiCallHistory: "API Call History", queueHistory: "Queue History", intentFeedback: "Intent Feedback",
    conversationGroup: "Conversation Management", commonVariables: "Common Variables", defaultMessages: "Default Messages",
    integrationGroup: "System Integration", channels: "Channels", botstationStatus: "Bot Station Status",
    otherGroup: "Other", templates: "Templates", license: "License", licenseNotApplied: "License not applied",
    licenseChecking: "Checking license", licenseCheckFailed: "License check failed", expired: "Expired", verifying: "Verifying...",
  },
  "zh-CN": {
    systemAdministration: "CGA Studio 系统管理", userManagementGroup: "用户管理", userManagement: "用户管理",
    loginHistory: "登录历史", groupManagement: "组管理", statusGroup: "状态查询", auditLogs: "运营/系统日志",
    botStatus: "机器人状态", trainingHistory: "训练历史", conversationHistory: "对话历史",
    apiCallHistory: "API 调用历史", queueHistory: "队列历史", intentFeedback: "意图反馈",
    conversationGroup: "对话管理", commonVariables: "公共变量", defaultMessages: "默认消息",
    integrationGroup: "系统集成", channels: "渠道管理", botstationStatus: "Bot Station 状态",
    otherGroup: "其他管理", templates: "模板列表", license: "许可证", licenseNotApplied: "未应用许可证",
    licenseChecking: "正在检查许可证", licenseCheckFailed: "许可证检查失败", expired: "已过期", verifying: "正在确认...",
  },
  ja: {
    systemAdministration: "CGA Studio システム管理", userManagementGroup: "ユーザー管理", userManagement: "ユーザー管理",
    loginHistory: "ログイン履歴", groupManagement: "グループ管理", statusGroup: "状況照会", auditLogs: "運用/システムログ",
    botStatus: "ボット状況", trainingHistory: "学習履歴", conversationHistory: "会話履歴",
    apiCallHistory: "API 呼び出し履歴", queueHistory: "キュー履歴", intentFeedback: "インテント別フィードバック",
    conversationGroup: "会話管理", commonVariables: "共通変数", defaultMessages: "デフォルトメッセージ",
    integrationGroup: "システム連携", channels: "チャネル管理", botstationStatus: "Bot Station 連携状況",
    otherGroup: "その他", templates: "テンプレート一覧", license: "ライセンス", licenseNotApplied: "ライセンス未適用",
    licenseChecking: "ライセンス確認中", licenseCheckFailed: "ライセンス確認失敗", expired: "期限切れ", verifying: "確認中...",
  },
  vi: {
    systemAdministration: "Quản trị hệ thống CGA Studio", userManagementGroup: "Quản lý người dùng", userManagement: "Người dùng",
    loginHistory: "Lịch sử đăng nhập", groupManagement: "Nhóm", statusGroup: "Tra cứu trạng thái", auditLogs: "Nhật ký vận hành / hệ thống",
    botStatus: "Trạng thái bot", trainingHistory: "Lịch sử huấn luyện", conversationHistory: "Lịch sử hội thoại",
    apiCallHistory: "Lịch sử gọi API", queueHistory: "Lịch sử hàng đợi", intentFeedback: "Phản hồi ý định",
    conversationGroup: "Quản lý hội thoại", commonVariables: "Biến dùng chung", defaultMessages: "Tin nhắn mặc định",
    integrationGroup: "Tích hợp hệ thống", channels: "Quản lý kênh", botstationStatus: "Trạng thái Bot Station",
    otherGroup: "Khác", templates: "Danh sách mẫu", license: "Giấy phép", licenseNotApplied: "Chưa áp dụng giấy phép",
    licenseChecking: "Đang kiểm tra giấy phép", licenseCheckFailed: "Kiểm tra giấy phép thất bại", expired: "Hết hạn", verifying: "Đang xác nhận...",
  },
  fr: {
    systemAdministration: "Administration système CGA Studio", userManagementGroup: "Gestion des utilisateurs", userManagement: "Utilisateurs",
    loginHistory: "Historique des connexions", groupManagement: "Groupes", statusGroup: "État", auditLogs: "Journaux d’exploitation / système",
    botStatus: "État des bots", trainingHistory: "Historique d’entraînement", conversationHistory: "Historique des conversations",
    apiCallHistory: "Historique des appels API", queueHistory: "Historique de la file", intentFeedback: "Retours par intention",
    conversationGroup: "Gestion des conversations", commonVariables: "Variables communes", defaultMessages: "Messages par défaut",
    integrationGroup: "Intégration système", channels: "Canaux", botstationStatus: "État de Bot Station",
    otherGroup: "Autres", templates: "Modèles", license: "Licence", licenseNotApplied: "Licence non appliquée",
    licenseChecking: "Vérification de la licence", licenseCheckFailed: "Échec de la vérification de la licence", expired: "Expirée", verifying: "Vérification...",
  },
  de: {
    systemAdministration: "CGA Studio Systemverwaltung", userManagementGroup: "Benutzerverwaltung", userManagement: "Benutzer",
    loginHistory: "Anmeldeverlauf", groupManagement: "Gruppen", statusGroup: "Status", auditLogs: "Betriebs-/Systemprotokolle",
    botStatus: "Bot-Status", trainingHistory: "Trainingsverlauf", conversationHistory: "Gesprächsverlauf",
    apiCallHistory: "API-Aufrufverlauf", queueHistory: "Queue-Verlauf", intentFeedback: "Intent-Feedback",
    conversationGroup: "Gesprächsverwaltung", commonVariables: "Gemeinsame Variablen", defaultMessages: "Standardnachrichten",
    integrationGroup: "Systemintegration", channels: "Kanäle", botstationStatus: "Bot-Station-Status",
    otherGroup: "Sonstiges", templates: "Vorlagen", license: "Lizenz", licenseNotApplied: "Keine Lizenz angewendet",
    licenseChecking: "Lizenz wird geprüft", licenseCheckFailed: "Lizenzprüfung fehlgeschlagen", expired: "Abgelaufen", verifying: "Wird geprüft...",
  },
} satisfies Record<SupportedLanguage, AdminNavigationCatalog>;

export function buildAdminNavigationGroups(copy: AdminNavigationCatalog): AdminNavigationGroup[] {
  return [
    { key: "users", title: copy.userManagementGroup, items: [
      { href: "/admin/users", label: copy.userManagement }, { href: "/admin/login-history", label: copy.loginHistory },
      { href: "/admin/groups", label: copy.groupManagement },
    ] },
    { key: "status", title: copy.statusGroup, items: [
      { href: "/admin/audit-logs", label: copy.auditLogs }, { href: "/admin/bot-status", label: copy.botStatus },
      { href: "/admin/training-history", label: copy.trainingHistory }, { href: "/admin/conversations", label: copy.conversationHistory },
      { href: "/admin/api-call-history", label: copy.apiCallHistory }, { href: "/admin/queue-history", label: copy.queueHistory },
      { href: "/admin/intent-feedback", label: copy.intentFeedback },
    ] },
    { key: "conversation", title: copy.conversationGroup, items: [
      { href: "/admin/common-variables", label: copy.commonVariables }, { href: "/admin/default-messages", label: copy.defaultMessages },
    ] },
    { key: "integration", title: copy.integrationGroup, items: [
      { href: "/admin/channels", label: copy.channels }, { href: "/admin/botstation-status", label: copy.botstationStatus },
    ] },
    { key: "other", title: copy.otherGroup, items: [
      { href: "/admin/templates", label: copy.templates }, { href: "/admin/license", label: copy.license },
    ] },
  ];
}
