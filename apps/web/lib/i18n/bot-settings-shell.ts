import type { SupportedLanguage } from "@/lib/language";

export type BotSettingsShellCatalog = {
  settings: string;
  basicConversation: string;
  integrations: string;
  loginRequired: string;
  loadError: string;
  creationManagement: string;
  bot: string;
  lastModified: string;
  botSettings: string;
  priorityBot: string;
  edit: string;
  delete: string;
  settingsMenu: string;
  loading: string;
};

export const BOT_SETTINGS_SHELL_CATALOGS = {
  ko: { settings: "설정", basicConversation: "기본 대화", integrations: "연계", loginRequired: "로그인이 필요합니다.", loadError: "봇 설정 정보를 불러오지 못했습니다.", creationManagement: "챗봇 생성 및 관리하기", bot: "봇", lastModified: "최종수정일시", botSettings: "봇 설정", priorityBot: "우선 봇", edit: "수정", delete: "삭제", settingsMenu: "설정 메뉴", loading: "설정 화면을 불러오는 중입니다..." },
  en: { settings: "Settings", basicConversation: "Basic Conversation", integrations: "Integrations", loginRequired: "Sign-in is required.", loadError: "Could not load bot settings.", creationManagement: "Create and Manage Bots", bot: "Bot", lastModified: "Last Modified", botSettings: "Bot Settings", priorityBot: "Priority Bot", edit: "Edit", delete: "Delete", settingsMenu: "Settings Menu", loading: "Loading settings..." },
  "zh-CN": { settings: "设置", basicConversation: "基础对话", integrations: "集成", loginRequired: "需要登录。", loadError: "无法加载机器人设置。", creationManagement: "创建和管理机器人", bot: "机器人", lastModified: "最后修改", botSettings: "机器人设置", priorityBot: "优先机器人", edit: "修改", delete: "删除", settingsMenu: "设置菜单", loading: "正在加载设置..." },
  ja: { settings: "設定", basicConversation: "基本対話", integrations: "連携", loginRequired: "ログインが必要です。", loadError: "ボット設定を読み込めませんでした。", creationManagement: "ボットの作成と管理", bot: "ボット", lastModified: "最終更新日時", botSettings: "ボット設定", priorityBot: "優先ボット", edit: "編集", delete: "削除", settingsMenu: "設定メニュー", loading: "設定画面を読み込んでいます..." },
  vi: { settings: "Cài đặt", basicConversation: "Hội thoại cơ bản", integrations: "Tích hợp", loginRequired: "Cần đăng nhập.", loadError: "Không thể tải cài đặt bot.", creationManagement: "Tạo và quản lý bot", bot: "Bot", lastModified: "Sửa lần cuối", botSettings: "Cài đặt bot", priorityBot: "Bot ưu tiên", edit: "Sửa", delete: "Xóa", settingsMenu: "Menu cài đặt", loading: "Đang tải cài đặt..." },
  fr: { settings: "Paramètres", basicConversation: "Conversation de base", integrations: "Intégrations", loginRequired: "La connexion est requise.", loadError: "Impossible de charger les paramètres du bot.", creationManagement: "Créer et gérer les bots", bot: "Bot", lastModified: "Dernière modification", botSettings: "Paramètres du bot", priorityBot: "Bot prioritaire", edit: "Modifier", delete: "Supprimer", settingsMenu: "Menu des paramètres", loading: "Chargement des paramètres..." },
  de: { settings: "Einstellungen", basicConversation: "Basisdialog", integrations: "Integrationen", loginRequired: "Eine Anmeldung ist erforderlich.", loadError: "Die Bot-Einstellungen konnten nicht geladen werden.", creationManagement: "Bots erstellen und verwalten", bot: "Bot", lastModified: "Zuletzt geändert", botSettings: "Bot-Einstellungen", priorityBot: "Prioritäts-Bot", edit: "Bearbeiten", delete: "Löschen", settingsMenu: "Einstellungsmenü", loading: "Einstellungen werden geladen..." },
} satisfies Record<SupportedLanguage, BotSettingsShellCatalog>;
