import type { SupportedLanguage } from "@/lib/language";

export type PageShellCatalog = {
  partial: string;
  shell: string;
  manualItems: string;
  currentNotes: string;
  nextPaths: string;
  inferred: string;
};

type UtilityRouteCopy = {
  title: string;
  description: string;
};

export type UtilityPageCatalog = {
  license: UtilityRouteCopy & { popup: string; alert: string; login: string };
  licensePopup: UtilityRouteCopy & { licenseInfo: string; alert: string };
  licenseAlert: UtilityRouteCopy & { licenseInfo: string; login: string };
  tenantSwitch: UtilityRouteCopy & { manualTitle: string; login: string; profile: string; licenseInfo: string };
  dashboardPreparing: string;
};

export const PAGE_SHELL_CATALOGS = {
  ko: { partial: "부분 구현", shell: "화면 셸", manualItems: "매뉴얼 대응 항목", currentNotes: "현재 메모", nextPaths: "다음 확인 경로", inferred: "추측 포함" },
  en: { partial: "Partially implemented", shell: "Screen shell", manualItems: "Manual references", currentNotes: "Current notes", nextPaths: "Next paths", inferred: "Includes inference" },
  "zh-CN": { partial: "部分实现", shell: "画面框架", manualItems: "手册对应项目", currentNotes: "当前备注", nextPaths: "后续查看路径", inferred: "包含推测" },
  ja: { partial: "一部実装", shell: "画面シェル", manualItems: "マニュアル対応項目", currentNotes: "現在のメモ", nextPaths: "次の確認先", inferred: "推測を含む" },
  vi: { partial: "Đã triển khai một phần", shell: "Khung màn hình", manualItems: "Mục tương ứng trong hướng dẫn", currentNotes: "Ghi chú hiện tại", nextPaths: "Đường dẫn kiểm tra tiếp theo", inferred: "Có nội dung suy đoán" },
  fr: { partial: "Partiellement réalisé", shell: "Structure écran", manualItems: "Références du manuel", currentNotes: "Notes actuelles", nextPaths: "Étapes suivantes", inferred: "Inclut une déduction" },
  de: { partial: "Teilweise umgesetzt", shell: "Bildschirmgerüst", manualItems: "Handbuchreferenzen", currentNotes: "Aktuelle Hinweise", nextPaths: "Nächste Prüfpfade", inferred: "Enthält Annahmen" },
} satisfies Record<SupportedLanguage, PageShellCatalog>;

export const UTILITY_PAGE_CATALOGS = {
  ko: {
    license: { title: "라이선스 정보 조회", description: "도움말 아이콘을 통해 진입하는 라이선스 정보 중심 화면 셸입니다.", popup: "라이선스 팝업", alert: "라이선스 알림창", login: "로그인" },
    licensePopup: { title: "라이선스 팝업", description: "라이선스 상세 정보를 팝업 형식으로 확인하는 화면 셸입니다.", licenseInfo: "라이선스 정보 조회", alert: "라이선스 알림창" },
    licenseAlert: { title: "라이선스 알림창", description: "라이선스 만료 또는 상태 안내를 표시하는 화면 셸입니다.", licenseInfo: "라이선스 정보 조회", login: "로그인" },
    tenantSwitch: { title: "테넌트 전환", description: "사용 가능한 테넌트를 전환하는 시작 화면 셸입니다.", manualTitle: "테넌트 전환하기", login: "로그인", profile: "내 정보", licenseInfo: "라이선스 정보" },
    dashboardPreparing: "메인 화면을 준비하는 중입니다...",
  },
  en: {
    license: { title: "License Information", description: "A screen shell for license information accessed from Help.", popup: "License popup", alert: "License alert", login: "Sign in" },
    licensePopup: { title: "License Popup", description: "A screen shell for viewing license details as a popup.", licenseInfo: "License information", alert: "License alert" },
    licenseAlert: { title: "License Alert", description: "A screen shell that displays license expiration or status notices.", licenseInfo: "License information", login: "Sign in" },
    tenantSwitch: { title: "Switch Tenant", description: "A starting screen shell for switching between available tenants.", manualTitle: "Switch tenants", login: "Sign in", profile: "My profile", licenseInfo: "License information" },
    dashboardPreparing: "Preparing the main screen...",
  },
  "zh-CN": {
    license: { title: "查看许可证信息", description: "通过帮助图标进入的许可证信息画面框架。", popup: "许可证弹窗", alert: "许可证提醒", login: "登录" },
    licensePopup: { title: "许可证弹窗", description: "以弹窗形式查看许可证详细信息的画面框架。", licenseInfo: "许可证信息", alert: "许可证提醒" },
    licenseAlert: { title: "许可证提醒", description: "显示许可证到期或状态通知的画面框架。", licenseInfo: "许可证信息", login: "登录" },
    tenantSwitch: { title: "切换租户", description: "用于切换可用租户的起始画面框架。", manualTitle: "切换租户", login: "登录", profile: "我的信息", licenseInfo: "许可证信息" },
    dashboardPreparing: "正在准备主画面...",
  },
  ja: {
    license: { title: "ライセンス情報照会", description: "ヘルプアイコンから開くライセンス情報画面のシェルです。", popup: "ライセンスポップアップ", alert: "ライセンス通知", login: "ログイン" },
    licensePopup: { title: "ライセンスポップアップ", description: "ライセンス詳細をポップアップ形式で確認する画面シェルです。", licenseInfo: "ライセンス情報照会", alert: "ライセンス通知" },
    licenseAlert: { title: "ライセンス通知", description: "ライセンス期限または状態案内を表示する画面シェルです。", licenseInfo: "ライセンス情報照会", login: "ログイン" },
    tenantSwitch: { title: "テナント切替", description: "使用可能なテナントを切り替える開始画面シェルです。", manualTitle: "テナントを切り替える", login: "ログイン", profile: "マイプロフィール", licenseInfo: "ライセンス情報" },
    dashboardPreparing: "メイン画面を準備しています...",
  },
  vi: {
    license: { title: "Thông tin giấy phép", description: "Khung màn hình thông tin giấy phép mở từ Trợ giúp.", popup: "Cửa sổ giấy phép", alert: "Thông báo giấy phép", login: "Đăng nhập" },
    licensePopup: { title: "Cửa sổ giấy phép", description: "Khung màn hình xem chi tiết giấy phép dạng cửa sổ bật lên.", licenseInfo: "Thông tin giấy phép", alert: "Thông báo giấy phép" },
    licenseAlert: { title: "Thông báo giấy phép", description: "Khung màn hình hiển thị thời hạn hoặc trạng thái giấy phép.", licenseInfo: "Thông tin giấy phép", login: "Đăng nhập" },
    tenantSwitch: { title: "Chuyển tenant", description: "Khung màn hình bắt đầu để chuyển tenant khả dụng.", manualTitle: "Chuyển tenant", login: "Đăng nhập", profile: "Hồ sơ của tôi", licenseInfo: "Thông tin giấy phép" },
    dashboardPreparing: "Đang chuẩn bị màn hình chính...",
  },
  fr: {
    license: { title: "Informations de licence", description: "Structure écran des informations de licence accessible depuis Aide.", popup: "Fenêtre de licence", alert: "Alerte de licence", login: "Connexion" },
    licensePopup: { title: "Fenêtre de licence", description: "Structure écran permettant de consulter les détails de la licence dans une fenêtre.", licenseInfo: "Informations de licence", alert: "Alerte de licence" },
    licenseAlert: { title: "Alerte de licence", description: "Structure écran affichant les avis expiration ou état de licence.", licenseInfo: "Informations de licence", login: "Connexion" },
    tenantSwitch: { title: "Changer de tenant", description: "Structure écran initiale permettant de changer de tenant disponible.", manualTitle: "Changer de tenant", login: "Connexion", profile: "Mon profil", licenseInfo: "Informations de licence" },
    dashboardPreparing: "Préparation de écran principal...",
  },
  de: {
    license: { title: "Lizenzinformationen", description: "Bildschirmgerüst für Lizenzinformationen, das über Hilfe geöffnet wird.", popup: "Lizenz-Popup", alert: "Lizenzhinweis", login: "Anmelden" },
    licensePopup: { title: "Lizenz-Popup", description: "Bildschirmgerüst zum Anzeigen von Lizenzdetails als Popup.", licenseInfo: "Lizenzinformationen", alert: "Lizenzhinweis" },
    licenseAlert: { title: "Lizenzhinweis", description: "Bildschirmgerüst für Hinweise zu Lizenzablauf oder Status.", licenseInfo: "Lizenzinformationen", login: "Anmelden" },
    tenantSwitch: { title: "Mandant wechseln", description: "Startbildschirmgerüst zum Wechseln verfügbarer Mandanten.", manualTitle: "Mandant wechseln", login: "Anmelden", profile: "Mein Profil", licenseInfo: "Lizenzinformationen" },
    dashboardPreparing: "Hauptbildschirm wird vorbereitet...",
  },
} satisfies Record<SupportedLanguage, UtilityPageCatalog>;