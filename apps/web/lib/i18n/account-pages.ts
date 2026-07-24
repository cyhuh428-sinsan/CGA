import type { SupportedLanguage } from "@/lib/language";

type SignupCopy = {
  loadFailed: string; submitFailed: string; title: string; description: string; loginId: string; loginIdPlaceholder: string;
  password: string; passwordPlaceholder: string; passwordConfirm: string; passwordConfirmPlaceholder: string; name: string;
  namePlaceholder: string; comment: string; commentPlaceholder: string; server: string; defaultServer: string; group: string;
  submitting: string; submit: string; existingAccount: string; login: string;
};

type ProfileCopy = {
  loginRequired: string; loadFailed: string; title: string; description: string; changePassword: string; changeLanguage: string;
  goToLogin: string; loading: string; account: string; userName: string; email: string; language: string; optionDisplay: string;
  icon: string; text: string; roles: string;
};

type PasswordCopy = {
  loginRequired: string; mismatch: string; changeFailed: string; title: string; description: string; profile: string;
  currentPassword: string; newPassword: string; newPasswordConfirm: string; changing: string; submit: string;
};

type LanguageCopy = {
  saved: string; title: string; description: string; profile: string; optionDisplay: string; text: string; icon: string; save: string;
};

export type AccountPageCatalog = {
  signup: SignupCopy;
  profile: ProfileCopy;
  password: PasswordCopy;
  language: LanguageCopy;
  roles: Record<string, string>;
};

export const ACCOUNT_PAGE_CATALOGS = {
  ko: {
    signup: { loadFailed: "회원가입 옵션을 불러오지 못했습니다.", submitFailed: "회원가입 처리 중 오류가 발생했습니다.", title: "회원 가입", description: "관리자 승인 후 로그인할 수 있습니다.", loginId: "아이디", loginIdPlaceholder: "아이디를 입력하세요.", password: "비밀번호", passwordPlaceholder: "비밀번호를 입력하세요.", passwordConfirm: "비밀번호 확인", passwordConfirmPlaceholder: "비밀번호를 다시 입력하세요.", name: "이름", namePlaceholder: "이름을 입력하세요.", comment: "코멘트", commentPlaceholder: "코멘트를 입력하세요.", server: "서버", defaultServer: "기본 서버", group: "그룹", submitting: "회원가입 신청 중...", submit: "회원가입 신청", existingAccount: "이미 계정이 있으신가요?", login: "로그인" },
    profile: { loginRequired: "로그인이 필요합니다.", loadFailed: "내 정보를 불러오지 못했습니다.", title: "내 정보", description: "현재 로그인한 사용자의 기본 정보를 확인합니다.", changePassword: "비밀번호 변경", changeLanguage: "사용자 언어 변경", goToLogin: "로그인으로 이동", loading: "불러오는 중입니다...", account: "사용자 계정", userName: "사용자 이름", email: "이메일", language: "사용자 언어", optionDisplay: "기타옵션 표시", icon: "아이콘", text: "글자", roles: "역할" },
    password: { loginRequired: "로그인이 필요합니다.", mismatch: "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.", changeFailed: "비밀번호 변경 중 오류가 발생했습니다.", title: "비밀번호 변경", description: "현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.", profile: "내 정보", currentPassword: "현재 비밀번호", newPassword: "새 비밀번호", newPasswordConfirm: "새 비밀번호 확인", changing: "변경 중...", submit: "비밀번호 변경" },
    language: { saved: "사용자 설정이 저장되었습니다.", title: "사용자 언어 변경", description: "로그인 화면과 작업 화면에서 사용할 기본 언어를 선택합니다.", profile: "내 정보", optionDisplay: "의도/모듈 기타옵션 표시", text: "글자", icon: "아이콘", save: "저장" },
    roles: { operation_manager: "운영관리자", system_manager: "시스템관리자", it_admin: "IT관리자", reviewer: "검토자", viewer: "조회자", curator: "큐레이터" },
  },
  en: {
    signup: { loadFailed: "Failed to load signup options.", submitFailed: "An error occurred while signing up.", title: "Create Account", description: "You can sign in after administrator approval.", loginId: "Login ID", loginIdPlaceholder: "Enter your login ID.", password: "Password", passwordPlaceholder: "Enter your password.", passwordConfirm: "Confirm Password", passwordConfirmPlaceholder: "Enter your password again.", name: "Name", namePlaceholder: "Enter your name.", comment: "Comment", commentPlaceholder: "Enter a comment.", server: "Server", defaultServer: "Default Server", group: "Group", submitting: "Submitting...", submit: "Request Signup", existingAccount: "Already have an account?", login: "Sign In" },
    profile: { loginRequired: "Login is required.", loadFailed: "Failed to load your profile.", title: "My Profile", description: "View the basic information for the signed-in user.", changePassword: "Change Password", changeLanguage: "Change Language", goToLogin: "Go to sign in", loading: "Loading...", account: "Account", userName: "User Name", email: "Email", language: "Language", optionDisplay: "Option Display", icon: "Icons", text: "Text", roles: "Roles" },
    password: { loginRequired: "Login is required.", mismatch: "The new password and confirmation do not match.", changeFailed: "Failed to change the password.", title: "Change Password", description: "Verify your current password, then set a new one.", profile: "My Profile", currentPassword: "Current Password", newPassword: "New Password", newPasswordConfirm: "Confirm New Password", changing: "Changing...", submit: "Change Password" },
    language: { saved: "User settings were saved.", title: "Change User Language", description: "Select the default language for sign-in and workspace screens.", profile: "My Profile", optionDisplay: "Intent/Module Option Display", text: "Text", icon: "Icons", save: "Save" },
    roles: { operation_manager: "Operations Manager", system_manager: "System Manager", it_admin: "IT Administrator", reviewer: "Reviewer", viewer: "Viewer", curator: "Curator" },
  },
  "zh-CN": {
    signup: { loadFailed: "无法加载注册选项。", submitFailed: "注册过程中发生错误。", title: "创建账户", description: "管理员批准后即可登录。", loginId: "登录 ID", loginIdPlaceholder: "请输入登录 ID。", password: "密码", passwordPlaceholder: "请输入密码。", passwordConfirm: "确认密码", passwordConfirmPlaceholder: "请再次输入密码。", name: "姓名", namePlaceholder: "请输入姓名。", comment: "备注", commentPlaceholder: "请输入备注。", server: "服务器", defaultServer: "默认服务器", group: "组", submitting: "正在提交...", submit: "申请注册", existingAccount: "已有账户？", login: "登录" },
    profile: { loginRequired: "需要登录。", loadFailed: "无法加载个人信息。", title: "我的信息", description: "查看当前登录用户的基本信息。", changePassword: "修改密码", changeLanguage: "更改用户语言", goToLogin: "前往登录", loading: "正在加载...", account: "用户账户", userName: "用户名", email: "电子邮件", language: "用户语言", optionDisplay: "其他选项显示", icon: "图标", text: "文字", roles: "角色" },
    password: { loginRequired: "需要登录。", mismatch: "新密码与确认密码不一致。", changeFailed: "修改密码时发生错误。", title: "修改密码", description: "验证当前密码后设置新密码。", profile: "我的信息", currentPassword: "当前密码", newPassword: "新密码", newPasswordConfirm: "确认新密码", changing: "正在修改...", submit: "修改密码" },
    language: { saved: "用户设置已保存。", title: "更改用户语言", description: "选择登录和工作界面的默认语言。", profile: "我的信息", optionDisplay: "意图/模块其他选项显示", text: "文字", icon: "图标", save: "保存" },
    roles: { operation_manager: "运营管理员", system_manager: "系统管理员", it_admin: "IT 管理员", reviewer: "审核者", viewer: "查看者", curator: "策展员" },
  },
  ja: {
    signup: { loadFailed: "会員登録オプションを読み込めませんでした。", submitFailed: "会員登録中にエラーが発生しました。", title: "アカウント作成", description: "管理者の承認後にログインできます。", loginId: "ログインID", loginIdPlaceholder: "ログインIDを入力してください。", password: "パスワード", passwordPlaceholder: "パスワードを入力してください。", passwordConfirm: "パスワード確認", passwordConfirmPlaceholder: "パスワードを再入力してください。", name: "名前", namePlaceholder: "名前を入力してください。", comment: "コメント", commentPlaceholder: "コメントを入力してください。", server: "サーバー", defaultServer: "デフォルトサーバー", group: "グループ", submitting: "申請中...", submit: "会員登録を申請", existingAccount: "アカウントをお持ちですか？", login: "ログイン" },
    profile: { loginRequired: "ログインが必要です。", loadFailed: "プロフィールを読み込めませんでした。", title: "マイプロフィール", description: "ログイン中のユーザーの基本情報を確認します。", changePassword: "パスワード変更", changeLanguage: "ユーザー言語変更", goToLogin: "ログインへ", loading: "読み込み中です...", account: "ユーザーアカウント", userName: "ユーザー名", email: "メール", language: "ユーザー言語", optionDisplay: "その他オプション表示", icon: "アイコン", text: "文字", roles: "ロール" },
    password: { loginRequired: "ログインが必要です。", mismatch: "新しいパスワードと確認が一致しません。", changeFailed: "パスワード変更中にエラーが発生しました。", title: "パスワード変更", description: "現在のパスワードを確認して新しいパスワードを設定します。", profile: "マイプロフィール", currentPassword: "現在のパスワード", newPassword: "新しいパスワード", newPasswordConfirm: "新しいパスワード確認", changing: "変更中...", submit: "パスワード変更" },
    language: { saved: "ユーザー設定を保存しました。", title: "ユーザー言語変更", description: "ログイン画面と作業画面で使用する言語を選択します。", profile: "マイプロフィール", optionDisplay: "インテント/モジュールその他オプション表示", text: "文字", icon: "アイコン", save: "保存" },
    roles: { operation_manager: "運用管理者", system_manager: "システム管理者", it_admin: "IT管理者", reviewer: "レビュアー", viewer: "閲覧者", curator: "キュレーター" },
  },
  vi: {
    signup: { loadFailed: "Không thể tải tùy chọn đăng ký.", submitFailed: "Đã xảy ra lỗi khi đăng ký.", title: "Tạo tài khoản", description: "Bạn có thể đăng nhập sau khi quản trị viên phê duyệt.", loginId: "ID đăng nhập", loginIdPlaceholder: "Nhập ID đăng nhập.", password: "Mật khẩu", passwordPlaceholder: "Nhập mật khẩu.", passwordConfirm: "Xác nhận mật khẩu", passwordConfirmPlaceholder: "Nhập lại mật khẩu.", name: "Tên", namePlaceholder: "Nhập tên.", comment: "Ghi chú", commentPlaceholder: "Nhập ghi chú.", server: "Máy chủ", defaultServer: "Máy chủ mặc định", group: "Nhóm", submitting: "Đang gửi...", submit: "Yêu cầu đăng ký", existingAccount: "Đã có tài khoản?", login: "Đăng nhập" },
    profile: { loginRequired: "Cần đăng nhập.", loadFailed: "Không thể tải hồ sơ.", title: "Hồ sơ của tôi", description: "Xem thông tin cơ bản của người dùng đang đăng nhập.", changePassword: "Đổi mật khẩu", changeLanguage: "Đổi ngôn ngữ", goToLogin: "Đi đến đăng nhập", loading: "Đang tải...", account: "Tài khoản", userName: "Tên người dùng", email: "Email", language: "Ngôn ngữ", optionDisplay: "Hiển thị tùy chọn", icon: "Biểu tượng", text: "Văn bản", roles: "Vai trò" },
    password: { loginRequired: "Cần đăng nhập.", mismatch: "Mật khẩu mới và xác nhận không khớp.", changeFailed: "Không thể đổi mật khẩu.", title: "Đổi mật khẩu", description: "Xác minh mật khẩu hiện tại rồi đặt mật khẩu mới.", profile: "Hồ sơ của tôi", currentPassword: "Mật khẩu hiện tại", newPassword: "Mật khẩu mới", newPasswordConfirm: "Xác nhận mật khẩu mới", changing: "Đang đổi...", submit: "Đổi mật khẩu" },
    language: { saved: "Đã lưu cài đặt người dùng.", title: "Đổi ngôn ngữ người dùng", description: "Chọn ngôn ngữ mặc định cho màn hình đăng nhập và làm việc.", profile: "Hồ sơ của tôi", optionDisplay: "Hiển thị tùy chọn ý định/mô-đun", text: "Văn bản", icon: "Biểu tượng", save: "Lưu" },
    roles: { operation_manager: "Quản lý vận hành", system_manager: "Quản trị hệ thống", it_admin: "Quản trị IT", reviewer: "Người đánh giá", viewer: "Người xem", curator: "Người quản lý nội dung" },
  },
  fr: {
    signup: { loadFailed: "Impossible de charger les options d’inscription.", submitFailed: "Une erreur est survenue pendant l’inscription.", title: "Créer un compte", description: "Vous pourrez vous connecter après l’approbation de l’administrateur.", loginId: "Identifiant", loginIdPlaceholder: "Saisissez votre identifiant.", password: "Mot de passe", passwordPlaceholder: "Saisissez votre mot de passe.", passwordConfirm: "Confirmer le mot de passe", passwordConfirmPlaceholder: "Saisissez à nouveau le mot de passe.", name: "Nom", namePlaceholder: "Saisissez votre nom.", comment: "Commentaire", commentPlaceholder: "Saisissez un commentaire.", server: "Serveur", defaultServer: "Serveur par défaut", group: "Groupe", submitting: "Envoi...", submit: "Demander l’inscription", existingAccount: "Vous avez déjà un compte ?", login: "Connexion" },
    profile: { loginRequired: "Connexion requise.", loadFailed: "Impossible de charger votre profil.", title: "Mon profil", description: "Consultez les informations de base de l’utilisateur connecté.", changePassword: "Modifier le mot de passe", changeLanguage: "Changer la langue", goToLogin: "Aller à la connexion", loading: "Chargement...", account: "Compte", userName: "Nom d’utilisateur", email: "E-mail", language: "Langue", optionDisplay: "Affichage des options", icon: "Icônes", text: "Texte", roles: "Rôles" },
    password: { loginRequired: "Connexion requise.", mismatch: "Le nouveau mot de passe et sa confirmation ne correspondent pas.", changeFailed: "Échec de la modification du mot de passe.", title: "Modifier le mot de passe", description: "Vérifiez le mot de passe actuel puis définissez-en un nouveau.", profile: "Mon profil", currentPassword: "Mot de passe actuel", newPassword: "Nouveau mot de passe", newPasswordConfirm: "Confirmer le nouveau mot de passe", changing: "Modification...", submit: "Modifier le mot de passe" },
    language: { saved: "Les paramètres utilisateur ont été enregistrés.", title: "Changer la langue utilisateur", description: "Sélectionnez la langue par défaut des écrans de connexion et de travail.", profile: "Mon profil", optionDisplay: "Affichage des options d’intention/module", text: "Texte", icon: "Icônes", save: "Enregistrer" },
    roles: { operation_manager: "Responsable des opérations", system_manager: "Administrateur système", it_admin: "Administrateur IT", reviewer: "Réviseur", viewer: "Lecteur", curator: "Curateur" },
  },
  de: {
    signup: { loadFailed: "Registrierungsoptionen konnten nicht geladen werden.", submitFailed: "Bei der Registrierung ist ein Fehler aufgetreten.", title: "Konto erstellen", description: "Nach der Freigabe durch einen Administrator können Sie sich anmelden.", loginId: "Anmelde-ID", loginIdPlaceholder: "Anmelde-ID eingeben.", password: "Passwort", passwordPlaceholder: "Passwort eingeben.", passwordConfirm: "Passwort bestätigen", passwordConfirmPlaceholder: "Passwort erneut eingeben.", name: "Name", namePlaceholder: "Name eingeben.", comment: "Kommentar", commentPlaceholder: "Kommentar eingeben.", server: "Server", defaultServer: "Standardserver", group: "Gruppe", submitting: "Wird gesendet...", submit: "Registrierung anfordern", existingAccount: "Bereits ein Konto?", login: "Anmelden" },
    profile: { loginRequired: "Anmeldung erforderlich.", loadFailed: "Profil konnte nicht geladen werden.", title: "Mein Profil", description: "Grundinformationen des angemeldeten Benutzers anzeigen.", changePassword: "Passwort ändern", changeLanguage: "Sprache ändern", goToLogin: "Zur Anmeldung", loading: "Wird geladen...", account: "Konto", userName: "Benutzername", email: "E-Mail", language: "Sprache", optionDisplay: "Optionsanzeige", icon: "Symbole", text: "Text", roles: "Rollen" },
    password: { loginRequired: "Anmeldung erforderlich.", mismatch: "Das neue Passwort und die Bestätigung stimmen nicht überein.", changeFailed: "Passwort konnte nicht geändert werden.", title: "Passwort ändern", description: "Aktuelles Passwort prüfen und anschließend ein neues festlegen.", profile: "Mein Profil", currentPassword: "Aktuelles Passwort", newPassword: "Neues Passwort", newPasswordConfirm: "Neues Passwort bestätigen", changing: "Wird geändert...", submit: "Passwort ändern" },
    language: { saved: "Benutzereinstellungen wurden gespeichert.", title: "Benutzersprache ändern", description: "Standardsprache für Anmeldung und Arbeitsbereich auswählen.", profile: "Mein Profil", optionDisplay: "Anzeige der Intent-/Moduloptionen", text: "Text", icon: "Symbole", save: "Speichern" },
    roles: { operation_manager: "Betriebsmanager", system_manager: "Systemadministrator", it_admin: "IT-Administrator", reviewer: "Prüfer", viewer: "Betrachter", curator: "Kurator" },
  },
} satisfies Record<SupportedLanguage, AccountPageCatalog>;

export function getAccountRoleLabel(catalog: AccountPageCatalog, roleCode: string) {
  return catalog.roles[roleCode] ?? roleCode;
}
