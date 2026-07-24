import type { SupportedLanguage } from "@/lib/language";

const ko = {
  "brand.subtitle": "봇 제작 스튜디오",
  "common.none": "선택 없음",
  "common.currentBot": "현재 봇",
  "common.noPermission": "권한 없음",
  "common.language": "언어",
  "common.login": "로그인",
  "common.logout": "로그아웃",
  "common.loggingOut": "로그아웃 중...",
  "common.close": "닫기",
  "header.context": "현재 작업 컨텍스트",
  "header.auth": "인증",
  "header.group": "그룹",
  "header.bot": "봇",
  "header.version": "버전",
  "login.id": "아이디",
  "login.password": "비밀번호",
  "login.preparing": "화면 준비 중...",
  "login.signingIn": "로그인 중...",
  "login.rememberId": "아이디 저장",
  "login.noAccount": "아직 계정이 없으신가요?",
  "login.signup": "회원가입",
  "login.error": "로그인 중 오류가 발생했습니다.",
  "nav.operations": "운영",
  "nav.build": "제작",
  "nav.help": "도움말",
  "nav.userMenu": "사용자 메뉴",
  "help.license": "라이선스",
  "help.version": "버전",
  "help.expires": "만료",
  "help.userManual": "사용자 매뉴얼",
  "help.nluGuide": "NLU 학습 가이드",
  "gettingStarted.title": "Getting Started",
  "gettingStarted.choose": "CGA Studio 체험 방법을 선택하세요.",
  "gettingStarted.explore": "주요메뉴 탐색하기",
  "gettingStarted.create": "봇 만들기",
  "gettingStarted.sample": "Sample Bot",
  "gettingStarted.freeStart": "팝업을 닫고, 자유로운 시작",
  "gettingStarted.start": "체험시작",
  "gettingStarted.hide": "시작할 때 이 팝업 다시 보지 않기",
} as const;

export type TranslationKey = keyof typeof ko;
export type TranslationCatalog = Record<TranslationKey, string>;

export const UI_CATALOGS = {
  "ko": ko,
  en: {
    "brand.subtitle": "Bot Creation Studio", "common.none": "None selected", "common.currentBot": "Current bot", "common.noPermission": "No permissions", "common.language": "Language", "common.login": "Sign in", "common.logout": "Sign out", "common.loggingOut": "Signing out...", "common.close": "Close", "header.context": "Current work context", "header.auth": "Authenticated", "header.group": "Group", "header.bot": "Bot", "header.version": "Version", "login.id": "Login ID", "login.password": "Password", "login.preparing": "Preparing...", "login.signingIn": "Signing in...", "login.rememberId": "Remember ID", "login.noAccount": "Don't have an account?", "login.signup": "Sign up", "login.error": "An error occurred while signing in.", "nav.operations": "Operations", "nav.build": "Build", "nav.help": "Help", "nav.userMenu": "User menu", "help.license": "License", "help.version": "Version", "help.expires": "expires", "help.userManual": "User Manual", "help.nluGuide": "NLU Training Guide", "gettingStarted.title": "Getting Started", "gettingStarted.choose": "Choose how to explore CGA Studio.", "gettingStarted.explore": "Explore main menus", "gettingStarted.create": "Create a bot", "gettingStarted.sample": "Sample Bot", "gettingStarted.freeStart": "Close and start freely", "gettingStarted.start": "Start", "gettingStarted.hide": "Don't show this popup at startup",
  },
  "zh-CN": {
    "brand.subtitle": "机器人制作工作室", "common.none": "未选择", "common.currentBot": "当前机器人", "common.noPermission": "无权限", "common.language": "语言", "common.login": "登录", "common.logout": "退出登录", "common.loggingOut": "正在退出...", "common.close": "关闭", "header.context": "当前工作上下文", "header.auth": "认证", "header.group": "组", "header.bot": "机器人", "header.version": "版本", "login.id": "账号", "login.password": "密码", "login.preparing": "正在准备...", "login.signingIn": "正在登录...", "login.rememberId": "记住账号", "login.noAccount": "还没有账号？", "login.signup": "注册", "login.error": "登录时发生错误。", "nav.operations": "运营", "nav.build": "制作", "nav.help": "帮助", "nav.userMenu": "用户菜单", "help.license": "许可证", "help.version": "版本", "help.expires": "到期", "help.userManual": "用户手册", "help.nluGuide": "NLU 训练指南", "gettingStarted.title": "入门指南", "gettingStarted.choose": "请选择 CGA Studio 体验方式。", "gettingStarted.explore": "浏览主要菜单", "gettingStarted.create": "创建机器人", "gettingStarted.sample": "示例机器人", "gettingStarted.freeStart": "关闭弹窗并自由开始", "gettingStarted.start": "开始体验", "gettingStarted.hide": "启动时不再显示此弹窗",
  },
  ja: {
    "brand.subtitle": "ボット作成スタジオ", "common.none": "未選択", "common.currentBot": "現在のボット", "common.noPermission": "権限なし", "common.language": "言語", "common.login": "ログイン", "common.logout": "ログアウト", "common.loggingOut": "ログアウト中...", "common.close": "閉じる", "header.context": "現在の作業コンテキスト", "header.auth": "認証", "header.group": "グループ", "header.bot": "ボット", "header.version": "バージョン", "login.id": "ログインID", "login.password": "パスワード", "login.preparing": "準備中...", "login.signingIn": "ログイン中...", "login.rememberId": "IDを保存", "login.noAccount": "アカウントをお持ちでないですか？", "login.signup": "新規登録", "login.error": "ログイン中にエラーが発生しました。", "nav.operations": "運用", "nav.build": "作成", "nav.help": "ヘルプ", "nav.userMenu": "ユーザーメニュー", "help.license": "ライセンス", "help.version": "バージョン", "help.expires": "有効期限", "help.userManual": "ユーザーマニュアル", "help.nluGuide": "NLU学習ガイド", "gettingStarted.title": "はじめに", "gettingStarted.choose": "CGA Studioの体験方法を選択してください。", "gettingStarted.explore": "主要メニューを見る", "gettingStarted.create": "ボットを作成", "gettingStarted.sample": "サンプルボット", "gettingStarted.freeStart": "閉じて自由に開始", "gettingStarted.start": "体験開始", "gettingStarted.hide": "起動時にこのポップアップを表示しない",
  },
  vi: {
    "brand.subtitle": "Studio tạo bot", "common.none": "Chưa chọn", "common.currentBot": "Bot hiện tại", "common.noPermission": "Không có quyền", "common.language": "Ngôn ngữ", "common.login": "Đăng nhập", "common.logout": "Đăng xuất", "common.loggingOut": "Đang đăng xuất...", "common.close": "Đóng", "header.context": "Ngữ cảnh làm việc hiện tại", "header.auth": "Xác thực", "header.group": "Nhóm", "header.bot": "Bot", "header.version": "Phiên bản", "login.id": "Tài khoản", "login.password": "Mật khẩu", "login.preparing": "Đang chuẩn bị...", "login.signingIn": "Đang đăng nhập...", "login.rememberId": "Ghi nhớ tài khoản", "login.noAccount": "Bạn chưa có tài khoản?", "login.signup": "Đăng ký", "login.error": "Đã xảy ra lỗi khi đăng nhập.", "nav.operations": "Vận hành", "nav.build": "Xây dựng", "nav.help": "Trợ giúp", "nav.userMenu": "Menu người dùng", "help.license": "Giấy phép", "help.version": "Phiên bản", "help.expires": "hết hạn", "help.userManual": "Hướng dẫn sử dụng", "help.nluGuide": "Hướng dẫn huấn luyện NLU", "gettingStarted.title": "Bắt đầu", "gettingStarted.choose": "Chọn cách trải nghiệm CGA Studio.", "gettingStarted.explore": "Khám phá menu chính", "gettingStarted.create": "Tạo bot", "gettingStarted.sample": "Bot mẫu", "gettingStarted.freeStart": "Đóng và tự do bắt đầu", "gettingStarted.start": "Bắt đầu", "gettingStarted.hide": "Không hiển thị lại khi khởi động",
  },
  fr: {
    "brand.subtitle": "Studio de création de bots", "common.none": "Aucune sélection", "common.currentBot": "Bot actuel", "common.noPermission": "Aucune autorisation", "common.language": "Langue", "common.login": "Connexion", "common.logout": "Déconnexion", "common.loggingOut": "Déconnexion...", "common.close": "Fermer", "header.context": "Contexte de travail actuel", "header.auth": "Authentification", "header.group": "Groupe", "header.bot": "Bot", "header.version": "Version", "login.id": "Identifiant", "login.password": "Mot de passe", "login.preparing": "Préparation...", "login.signingIn": "Connexion...", "login.rememberId": "Mémoriser l'identifiant", "login.noAccount": "Vous n'avez pas encore de compte ?", "login.signup": "S'inscrire", "login.error": "Une erreur est survenue lors de la connexion.", "nav.operations": "Exploitation", "nav.build": "Création", "nav.help": "Aide", "nav.userMenu": "Menu utilisateur", "help.license": "Licence", "help.version": "Version", "help.expires": "expire", "help.userManual": "Manuel utilisateur", "help.nluGuide": "Guide d'entraînement NLU", "gettingStarted.title": "Bien démarrer", "gettingStarted.choose": "Choisissez comment découvrir CGA Studio.", "gettingStarted.explore": "Explorer les menus", "gettingStarted.create": "Créer un bot", "gettingStarted.sample": "Bot exemple", "gettingStarted.freeStart": "Fermer et commencer librement", "gettingStarted.start": "Commencer", "gettingStarted.hide": "Ne plus afficher au démarrage",
  },
  de: {
    "brand.subtitle": "Bot-Erstellungsstudio", "common.none": "Keine Auswahl", "common.currentBot": "Aktueller Bot", "common.noPermission": "Keine Berechtigung", "common.language": "Sprache", "common.login": "Anmelden", "common.logout": "Abmelden", "common.loggingOut": "Abmeldung...", "common.close": "Schließen", "header.context": "Aktueller Arbeitskontext", "header.auth": "Authentifizierung", "header.group": "Gruppe", "header.bot": "Bot", "header.version": "Version", "login.id": "Anmelde-ID", "login.password": "Passwort", "login.preparing": "Wird vorbereitet...", "login.signingIn": "Anmeldung...", "login.rememberId": "ID speichern", "login.noAccount": "Noch kein Konto?", "login.signup": "Registrieren", "login.error": "Bei der Anmeldung ist ein Fehler aufgetreten.", "nav.operations": "Betrieb", "nav.build": "Erstellung", "nav.help": "Hilfe", "nav.userMenu": "Benutzermenü", "help.license": "Lizenz", "help.version": "Version", "help.expires": "läuft ab", "help.userManual": "Benutzerhandbuch", "help.nluGuide": "NLU-Trainingsleitfaden", "gettingStarted.title": "Erste Schritte", "gettingStarted.choose": "Wählen Sie, wie Sie CGA Studio erkunden möchten.", "gettingStarted.explore": "Hauptmenüs erkunden", "gettingStarted.create": "Bot erstellen", "gettingStarted.sample": "Beispiel-Bot", "gettingStarted.freeStart": "Schließen und frei starten", "gettingStarted.start": "Starten", "gettingStarted.hide": "Beim Start nicht wieder anzeigen",
  },
} satisfies Record<SupportedLanguage, TranslationCatalog>;
