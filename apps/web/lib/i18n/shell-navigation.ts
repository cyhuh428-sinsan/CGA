import type { SupportedLanguage } from "@/lib/language";

export type ShellNavigationCatalog = {
  operationsPanel: string;
  buildPanel: string;
  systemPanel: string;
  botManagement: string;
  botWorkspace: string;
  dbDashboard: string;
  retraining: string;
  analysis: string;
  botCreate: string;
  botSettings: string;
  aiModelSettings: string;
  defaultsSettings: string;
  messageSettings: string;
  messengerFeatures: string;
  blocklistSettings: string;
  ruleSettings: string;
  smalltalk: string;
  botstation: string;
  botConfigure: string;
  botBuild: string;
  intentManagement: string;
  entityManagement: string;
  dictionaryManagement: string;
  botTest: string;
  botEvaluation: string;
  editProfile: string;
  userLanguage: string;
};

export const SHELL_NAVIGATION = {
  ko: { operationsPanel: "봇 운영", buildPanel: "봇 제작", systemPanel: "시스템 관리", botManagement: "봇 관리", botWorkspace: "봇 작업공간", dbDashboard: "DB 운영 대시보드", retraining: "재학습", analysis: "분석", botCreate: "봇 생성", botSettings: "봇 설정", aiModelSettings: "AI 모델 설정", defaultsSettings: "기본값 설정", messageSettings: "메시지 설정", messengerFeatures: "메신저 편의 기능", blocklistSettings: "제외/무시 목록 설정", ruleSettings: "룰 설정", smalltalk: "스몰토크", botstation: "봇스테이션", botConfigure: "봇 구성", botBuild: "봇 제작", intentManagement: "의도/모듈 관리", entityManagement: "개체 관리", dictionaryManagement: "사전 관리", botTest: "봇 테스트", botEvaluation: "봇 평가", editProfile: "사용자 정보 수정", userLanguage: "사용자 언어" },
  en: { operationsPanel: "Bot Operations", buildPanel: "Bot Build", systemPanel: "System Administration", botManagement: "Bot Management", botWorkspace: "Bot Workspace", dbDashboard: "DB Operations Dashboard", retraining: "Retraining", analysis: "Analysis", botCreate: "Create Bot", botSettings: "Bot Settings", aiModelSettings: "AI Model Settings", defaultsSettings: "Default Settings", messageSettings: "Message Settings", messengerFeatures: "Messenger Features", blocklistSettings: "Exclude/Ignore List", ruleSettings: "Rule Settings", smalltalk: "Small Talk", botstation: "Bot Station", botConfigure: "Bot Configuration", botBuild: "Bot Build", intentManagement: "Intent/Module Management", entityManagement: "Entity Management", dictionaryManagement: "Dictionary Management", botTest: "Bot Test", botEvaluation: "Bot Evaluation", editProfile: "Edit Profile", userLanguage: "User Language" },
  "zh-CN": { operationsPanel: "机器人运营", buildPanel: "机器人制作", systemPanel: "系统管理", botManagement: "机器人管理", botWorkspace: "机器人工作区", dbDashboard: "数据库运营仪表板", retraining: "重新训练", analysis: "分析", botCreate: "创建机器人", botSettings: "机器人设置", aiModelSettings: "AI 模型设置", defaultsSettings: "默认值设置", messageSettings: "消息设置", messengerFeatures: "消息工具功能", blocklistSettings: "排除/忽略列表", ruleSettings: "规则设置", smalltalk: "闲聊", botstation: "Bot Station", botConfigure: "机器人配置", botBuild: "机器人制作", intentManagement: "意图/模块管理", entityManagement: "实体管理", dictionaryManagement: "词典管理", botTest: "机器人测试", botEvaluation: "机器人评估", editProfile: "编辑用户信息", userLanguage: "用户语言" },
  ja: { operationsPanel: "ボット運用", buildPanel: "ボット作成", systemPanel: "システム管理", botManagement: "ボット管理", botWorkspace: "ボット作業領域", dbDashboard: "DB運用ダッシュボード", retraining: "再学習", analysis: "分析", botCreate: "ボット作成", botSettings: "ボット設定", aiModelSettings: "AIモデル設定", defaultsSettings: "既定値設定", messageSettings: "メッセージ設定", messengerFeatures: "メッセンジャー機能", blocklistSettings: "除外/無視リスト", ruleSettings: "ルール設定", smalltalk: "スモールトーク", botstation: "Bot Station", botConfigure: "ボット構成", botBuild: "ボット作成", intentManagement: "意図/モジュール管理", entityManagement: "エンティティ管理", dictionaryManagement: "辞書管理", botTest: "ボットテスト", botEvaluation: "ボット評価", editProfile: "ユーザー情報を編集", userLanguage: "ユーザー言語" },
  vi: { operationsPanel: "Vận hành bot", buildPanel: "Xây dựng bot", systemPanel: "Quản trị hệ thống", botManagement: "Quản lý bot", botWorkspace: "Không gian làm việc bot", dbDashboard: "Bảng điều khiển vận hành DB", retraining: "Huấn luyện lại", analysis: "Phân tích", botCreate: "Tạo bot", botSettings: "Cài đặt bot", aiModelSettings: "Cài đặt mô hình AI", defaultsSettings: "Cài đặt mặc định", messageSettings: "Cài đặt tin nhắn", messengerFeatures: "Tính năng nhắn tin", blocklistSettings: "Danh sách loại trừ/bỏ qua", ruleSettings: "Cài đặt quy tắc", smalltalk: "Trò chuyện ngắn", botstation: "Bot Station", botConfigure: "Cấu hình bot", botBuild: "Xây dựng bot", intentManagement: "Quản lý ý định/mô-đun", entityManagement: "Quản lý thực thể", dictionaryManagement: "Quản lý từ điển", botTest: "Kiểm thử bot", botEvaluation: "Đánh giá bot", editProfile: "Sửa thông tin người dùng", userLanguage: "Ngôn ngữ người dùng" },
  fr: { operationsPanel: "Exploitation du bot", buildPanel: "Création du bot", systemPanel: "Administration système", botManagement: "Gestion des bots", botWorkspace: "Espace de travail du bot", dbDashboard: "Tableau de bord d'exploitation DB", retraining: "Réentraînement", analysis: "Analyse", botCreate: "Créer un bot", botSettings: "Paramètres du bot", aiModelSettings: "Paramètres du modèle IA", defaultsSettings: "Paramètres par défaut", messageSettings: "Paramètres des messages", messengerFeatures: "Fonctions de messagerie", blocklistSettings: "Liste d'exclusion/ignorée", ruleSettings: "Paramètres des règles", smalltalk: "Petite conversation", botstation: "Bot Station", botConfigure: "Configuration du bot", botBuild: "Création du bot", intentManagement: "Gestion des intentions/modules", entityManagement: "Gestion des entités", dictionaryManagement: "Gestion du dictionnaire", botTest: "Test du bot", botEvaluation: "Évaluation du bot", editProfile: "Modifier le profil", userLanguage: "Langue utilisateur" },
  de: { operationsPanel: "Bot-Betrieb", buildPanel: "Bot-Erstellung", systemPanel: "Systemverwaltung", botManagement: "Bot-Verwaltung", botWorkspace: "Bot-Arbeitsbereich", dbDashboard: "DB-Betriebsdashboard", retraining: "Nachtraining", analysis: "Analyse", botCreate: "Bot erstellen", botSettings: "Bot-Einstellungen", aiModelSettings: "KI-Modell-Einstellungen", defaultsSettings: "Standardeinstellungen", messageSettings: "Nachrichteneinstellungen", messengerFeatures: "Messenger-Funktionen", blocklistSettings: "Ausschluss-/Ignorierliste", ruleSettings: "Regel-Einstellungen", smalltalk: "Small Talk", botstation: "Bot Station", botConfigure: "Bot-Konfiguration", botBuild: "Bot-Erstellung", intentManagement: "Intent-/Modulverwaltung", entityManagement: "Entitätsverwaltung", dictionaryManagement: "Wörterbuchverwaltung", botTest: "Bot-Test", botEvaluation: "Bot-Bewertung", editProfile: "Benutzerprofil bearbeiten", userLanguage: "Benutzersprache" },
} satisfies Record<SupportedLanguage, ShellNavigationCatalog>;
