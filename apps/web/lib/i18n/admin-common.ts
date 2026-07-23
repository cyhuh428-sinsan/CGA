import type { SupportedLanguage } from "@/lib/language";

export type AdminCommonCatalog = {
  filter: string; search: string; reset: string; confirm: string; loading: string; loadingDetail: string;
  loginRequired: string; goToLogin: string; loadFailed: string; noData: string; group: string; bot: string;
  channel: string; allGroups: string; allBots: string; allChannels: string; fromDate: string; toDate: string;
  previousPage: string; nextPage: string; totalCount: string; pageSize: string; download: string;
};

export const ADMIN_COMMON_CATALOGS = {
  ko: {
    filter: "필터", search: "검색", reset: "초기화", confirm: "확인", loading: "불러오는 중", loadingDetail: "불러오는 중입니다...",
    loginRequired: "로그인이 필요합니다.", goToLogin: "로그인으로 이동", loadFailed: "이력을 불러오지 못했습니다.", noData: "조회 결과가 없습니다.",
    group: "그룹", bot: "봇", channel: "채널", allGroups: "전체 그룹", allBots: "전체 봇", allChannels: "전체 채널",
    fromDate: "시작일", toDate: "종료일", previousPage: "이전 페이지", nextPage: "다음 페이지",
    totalCount: "전체 {count}건", pageSize: "{count}개씩 보기", download: "다운로드",
  },
  en: {
    filter: "Filter", search: "Search", reset: "Reset", confirm: "Confirm", loading: "Loading", loadingDetail: "Loading...",
    loginRequired: "Login is required.", goToLogin: "Go to login", loadFailed: "Failed to load history.", noData: "No results found.",
    group: "Group", bot: "Bot", channel: "Channel", allGroups: "All groups", allBots: "All bots", allChannels: "All channels",
    fromDate: "From", toDate: "To", previousPage: "Previous page", nextPage: "Next page",
    totalCount: "Total {count}", pageSize: "{count} per page", download: "Download",
  },
  "zh-CN": {
    filter: "筛选", search: "搜索", reset: "重置", confirm: "确认", loading: "加载中", loadingDetail: "正在加载...",
    loginRequired: "需要登录。", goToLogin: "前往登录", loadFailed: "无法加载历史记录。", noData: "没有查询结果。",
    group: "组", bot: "机器人", channel: "渠道", allGroups: "所有组", allBots: "所有机器人", allChannels: "所有渠道",
    fromDate: "开始日期", toDate: "结束日期", previousPage: "上一页", nextPage: "下一页",
    totalCount: "共 {count} 条", pageSize: "每页 {count} 条", download: "下载",
  },
  ja: {
    filter: "フィルター", search: "検索", reset: "リセット", confirm: "確認", loading: "読み込み中", loadingDetail: "読み込み中です...",
    loginRequired: "ログインが必要です。", goToLogin: "ログインへ", loadFailed: "履歴を読み込めませんでした。", noData: "検索結果がありません。",
    group: "グループ", bot: "ボット", channel: "チャネル", allGroups: "すべてのグループ", allBots: "すべてのボット", allChannels: "すべてのチャネル",
    fromDate: "開始日", toDate: "終了日", previousPage: "前のページ", nextPage: "次のページ",
    totalCount: "全 {count} 件", pageSize: "{count}件ずつ表示", download: "ダウンロード",
  },
  vi: {
    filter: "Bộ lọc", search: "Tìm kiếm", reset: "Đặt lại", confirm: "Xác nhận", loading: "Đang tải", loadingDetail: "Đang tải...",
    loginRequired: "Cần đăng nhập.", goToLogin: "Đi đến đăng nhập", loadFailed: "Không thể tải lịch sử.", noData: "Không có kết quả.",
    group: "Nhóm", bot: "Bot", channel: "Kênh", allGroups: "Tất cả nhóm", allBots: "Tất cả bot", allChannels: "Tất cả kênh",
    fromDate: "Từ ngày", toDate: "Đến ngày", previousPage: "Trang trước", nextPage: "Trang sau",
    totalCount: "Tổng {count}", pageSize: "{count} mỗi trang", download: "Tải xuống",
  },
  fr: {
    filter: "Filtrer", search: "Rechercher", reset: "Réinitialiser", confirm: "Confirmer", loading: "Chargement", loadingDetail: "Chargement...",
    loginRequired: "Connexion requise.", goToLogin: "Aller à la connexion", loadFailed: "Impossible de charger l’historique.", noData: "Aucun résultat.",
    group: "Groupe", bot: "Bot", channel: "Canal", allGroups: "Tous les groupes", allBots: "Tous les bots", allChannels: "Tous les canaux",
    fromDate: "Date de début", toDate: "Date de fin", previousPage: "Page précédente", nextPage: "Page suivante",
    totalCount: "Total {count}", pageSize: "{count} par page", download: "Télécharger",
  },
  de: {
    filter: "Filter", search: "Suchen", reset: "Zurücksetzen", confirm: "Bestätigen", loading: "Wird geladen", loadingDetail: "Wird geladen...",
    loginRequired: "Anmeldung erforderlich.", goToLogin: "Zur Anmeldung", loadFailed: "Verlauf konnte nicht geladen werden.", noData: "Keine Ergebnisse.",
    group: "Gruppe", bot: "Bot", channel: "Kanal", allGroups: "Alle Gruppen", allBots: "Alle Bots", allChannels: "Alle Kanäle",
    fromDate: "Von", toDate: "Bis", previousPage: "Vorherige Seite", nextPage: "Nächste Seite",
    totalCount: "Gesamt {count}", pageSize: "{count} pro Seite", download: "Herunterladen",
  },
} satisfies Record<SupportedLanguage, AdminCommonCatalog>;

export function formatAdminText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
