import type { SupportedLanguage } from "@/lib/language";

type ConnectionCopy = Record<"title" | "add" | "name" | "bot" | "installation" | "account" | "target" | "credentials" |
  "registered" | "missing" | "save" | "cancel" | "close" | "edit" | "remove" | "check" | "disconnect" | "connect" |
  "pending" | "configOk" | "saved" | "deleted" | "confirmDelete" | "empty" | "loading" | "error" | "selectBot" |
  "preserve" | "disconnected" | "connecting" | "connected" | "disconnecting" | "stateError" | "keyUnavailable" |
  "duplicate" | "disconnectFirst" | "invalidCredentials" | "lastChecked" | "notChecked" | "verificationFailed", string>;

export const CONNECTION_COPY = {
  ko: {
    title:"연결 대상", add:"연결 대상 추가", name:"연결 이름", bot:"답변 봇", installation:"설치·워크스페이스 ID", account:"외부 봇 계정 ID", target:"대상 방·채널 ID", credentials:"인증정보",
    registered:"등록됨", missing:"미등록", save:"설정 저장", cancel:"취소", close:"닫기", edit:"수정", remove:"삭제", check:"설정 검사", disconnect:"연결 해제", connect:"연결",
    pending:"실제 메신저 접속은 실행부 준비 후 지원합니다. 저장·설정 검사는 외부 접속을 하지 않습니다.", configOk:"설정 검사 통과 · 실제 접속 미확인", saved:"저장되었습니다.", deleted:"삭제되었습니다.", confirmDelete:"이 연결 설정을 삭제할까요? 대화 기록은 보존합니다.", empty:"등록된 연결 대상이 없습니다.", loading:"불러오는 중입니다…", error:"처리하지 못했습니다. 설정과 권한을 확인하세요.", selectBot:"봇 선택", preserve:"공란이면 기존 인증정보를 유지합니다.",
    disconnected:"미연결", connecting:"연결 중", connected:"연결됨", disconnecting:"해제 중", stateError:"오류", keyUnavailable:"서버의 연결 암호화 키 설정을 확인하세요.", duplicate:"같은 외부 계정·대상이 이미 등록되어 있습니다.", disconnectFirst:"연결 해제 후 수정·삭제하세요.", invalidCredentials:"인증정보 이름과 실제 값을 확인하세요.", lastChecked:"마지막 설정 검사", notChecked:"검사 전", verificationFailed:"연결 상태를 확인하고 설정 검사를 다시 실행하세요.",
  },
  en: {
    title:"Connections", add:"Add connection", name:"Name", bot:"Answer bot", installation:"Installation / workspace ID", account:"External bot account ID", target:"Room / channel ID", credentials:"Credentials",
    registered:"Registered", missing:"Not registered", save:"Save settings", cancel:"Cancel", close:"Close", edit:"Edit", remove:"Delete", check:"Check settings", disconnect:"Disconnect", connect:"Connect",
    pending:"Live messenger access requires the execution adapter. Saving and checking settings do not connect externally.", configOk:"Settings valid · external access unverified", saved:"Saved.", deleted:"Deleted.", confirmDelete:"Delete this connection setting? Conversation history is preserved.", empty:"No connections registered.", loading:"Loading…", error:"Unable to process. Check settings and permissions.", selectBot:"Select bot", preserve:"Leave blank to retain existing credentials.",
    disconnected:"Disconnected", connecting:"Connecting", connected:"Connected", disconnecting:"Disconnecting", stateError:"Error", keyUnavailable:"Check the server connection encryption key configuration.", duplicate:"This external account and target are already registered.", disconnectFirst:"Disconnect before editing or deleting.", invalidCredentials:"Check credential field names and actual values.", lastChecked:"Last settings check", notChecked:"Not checked", verificationFailed:"Check the connection status and run the settings check again.",
  },
  "zh-CN": {
    title:"连接目标", add:"添加连接", name:"连接名称", bot:"回答机器人", installation:"安装/工作区 ID", account:"外部机器人账户 ID", target:"房间/频道 ID", credentials:"凭据",
    registered:"已登记", missing:"未登记", save:"保存设置", cancel:"取消", close:"关闭", edit:"编辑", remove:"删除", check:"检查设置", disconnect:"断开连接", connect:"连接",
    pending:"实际接入需要执行适配器。保存和设置检查不会连接外部服务。", configOk:"设置有效 · 外部接入未验证", saved:"已保存。", deleted:"已删除。", confirmDelete:"删除此连接设置？对话记录将保留。", empty:"尚无连接目标。", loading:"正在加载…", error:"处理失败，请检查设置和权限。", selectBot:"选择机器人", preserve:"留空保留现有凭据。",
    disconnected:"未连接", connecting:"连接中", connected:"已连接", disconnecting:"断开中", stateError:"错误", keyUnavailable:"请检查服务器连接加密密钥设置。", duplicate:"此外部账户和目标已登记。", disconnectFirst:"请先断开连接再编辑或删除。", invalidCredentials:"请检查凭据名称和实际值。", lastChecked:"上次设置检查", notChecked:"未检查", verificationFailed:"请检查连接状态并重新检查设置。",
  },
  ja: {
    title:"接続先", add:"接続先を追加", name:"接続名", bot:"回答ボット", installation:"インストール・ワークスペース ID", account:"外部ボットアカウント ID", target:"ルーム・チャネル ID", credentials:"認証情報",
    registered:"登録済み", missing:"未登録", save:"設定を保存", cancel:"キャンセル", close:"閉じる", edit:"編集", remove:"削除", check:"設定を検査", disconnect:"接続解除", connect:"接続",
    pending:"実際の接続には実行アダプターが必要です。保存と設定検査では外部に接続しません。", configOk:"設定は有効・外部接続は未確認", saved:"保存しました。", deleted:"削除しました。", confirmDelete:"この接続設定を削除しますか？会話履歴は保持されます。", empty:"登録された接続先はありません。", loading:"読み込み中…", error:"処理できませんでした。設定と権限を確認してください。", selectBot:"ボットを選択", preserve:"空欄の場合は既存の認証情報を保持します。",
    disconnected:"未接続", connecting:"接続中", connected:"接続済み", disconnecting:"解除中", stateError:"エラー", keyUnavailable:"サーバーの接続暗号化キー設定を確認してください。", duplicate:"同じ外部アカウントと接続先が登録済みです。", disconnectFirst:"接続解除後に編集・削除してください。", invalidCredentials:"認証情報の項目名と実際の値を確認してください。", lastChecked:"最終設定検査", notChecked:"未検査", verificationFailed:"接続状態を確認し設定検査を再実行してください。",
  },
  vi: {
    title:"Kết nối", add:"Thêm kết nối", name:"Tên kết nối", bot:"Bot trả lời", installation:"ID cài đặt / không gian làm việc", account:"ID tài khoản bot bên ngoài", target:"ID phòng / kênh", credentials:"Thông tin xác thực",
    registered:"Đã đăng ký", missing:"Chưa đăng ký", save:"Lưu cài đặt", cancel:"Hủy", close:"Đóng", edit:"Sửa", remove:"Xóa", check:"Kiểm tra cài đặt", disconnect:"Ngắt kết nối", connect:"Kết nối",
    pending:"Truy cập thực tế cần bộ thực thi. Lưu và kiểm tra cài đặt không kết nối dịch vụ bên ngoài.", configOk:"Cài đặt hợp lệ · chưa xác minh truy cập thực tế", saved:"Đã lưu.", deleted:"Đã xóa.", confirmDelete:"Xóa cài đặt kết nối này? Lịch sử trò chuyện được giữ lại.", empty:"Chưa có kết nối.", loading:"Đang tải…", error:"Không thể xử lý. Kiểm tra cài đặt và quyền.", selectBot:"Chọn bot", preserve:"Để trống để giữ thông tin xác thực hiện có.",
    disconnected:"Chưa kết nối", connecting:"Đang kết nối", connected:"Đã kết nối", disconnecting:"Đang ngắt", stateError:"Lỗi", keyUnavailable:"Kiểm tra cấu hình khóa mã hóa kết nối trên máy chủ.", duplicate:"Tài khoản và đích bên ngoài này đã được đăng ký.", disconnectFirst:"Ngắt kết nối trước khi sửa hoặc xóa.", invalidCredentials:"Kiểm tra tên trường và giá trị xác thực thực tế.", lastChecked:"Lần kiểm tra gần nhất", notChecked:"Chưa kiểm tra", verificationFailed:"Kiểm tra trạng thái kết nối và chạy lại kiểm tra cài đặt.",
  },
  fr: {
    title:"Connexions", add:"Ajouter une connexion", name:"Nom", bot:"Bot de réponse", installation:"ID d’installation / espace de travail", account:"ID du compte bot externe", target:"ID de salon / canal", credentials:"Identifiants",
    registered:"Enregistrés", missing:"Non enregistrés", save:"Enregistrer les paramètres", cancel:"Annuler", close:"Fermer", edit:"Modifier", remove:"Supprimer", check:"Vérifier les paramètres", disconnect:"Déconnecter", connect:"Connecter",
    pending:"L’accès réel nécessite l’adaptateur d’exécution. L’enregistrement et la vérification ne contactent aucun service externe.", configOk:"Paramètres valides · accès externe non vérifié", saved:"Enregistré.", deleted:"Supprimé.", confirmDelete:"Supprimer cette connexion ? L’historique des conversations est conservé.", empty:"Aucune connexion enregistrée.", loading:"Chargement…", error:"Traitement impossible. Vérifiez les paramètres et les autorisations.", selectBot:"Choisir un bot", preserve:"Laissez vide pour conserver les identifiants actuels.",
    disconnected:"Déconnecté", connecting:"Connexion en cours", connected:"Connecté", disconnecting:"Déconnexion en cours", stateError:"Erreur", keyUnavailable:"Vérifiez la clé de chiffrement des connexions sur le serveur.", duplicate:"Ce compte externe et cette cible sont déjà enregistrés.", disconnectFirst:"Déconnectez avant de modifier ou supprimer.", invalidCredentials:"Vérifiez les noms des champs et leurs valeurs réelles.", lastChecked:"Dernière vérification", notChecked:"Non vérifié", verificationFailed:"Vérifiez l’état de la connexion puis relancez la vérification des paramètres.",
  },
  de: {
    title:"Verbindungen", add:"Verbindung hinzufügen", name:"Name", bot:"Antwort-Bot", installation:"Installations- / Workspace-ID", account:"Externe Bot-Konto-ID", target:"Raum- / Kanal-ID", credentials:"Zugangsdaten",
    registered:"Registriert", missing:"Nicht registriert", save:"Einstellungen speichern", cancel:"Abbrechen", close:"Schließen", edit:"Bearbeiten", remove:"Löschen", check:"Einstellungen prüfen", disconnect:"Trennen", connect:"Verbinden",
    pending:"Der tatsächliche Zugriff erfordert den Ausführungsadapter. Speichern und Prüfen verbinden sich nicht mit externen Diensten.", configOk:"Einstellungen gültig · externer Zugriff ungeprüft", saved:"Gespeichert.", deleted:"Gelöscht.", confirmDelete:"Diese Verbindung löschen? Der Gesprächsverlauf bleibt erhalten.", empty:"Keine Verbindungen registriert.", loading:"Wird geladen…", error:"Verarbeitung nicht möglich. Einstellungen und Berechtigungen prüfen.", selectBot:"Bot wählen", preserve:"Leer lassen, um vorhandene Zugangsdaten beizubehalten.",
    disconnected:"Getrennt", connecting:"Verbindung wird hergestellt", connected:"Verbunden", disconnecting:"Verbindung wird getrennt", stateError:"Fehler", keyUnavailable:"Prüfen Sie den Verbindungsschlüssel zur Verschlüsselung auf dem Server.", duplicate:"Dieses externe Konto und Ziel sind bereits registriert.", disconnectFirst:"Vor dem Bearbeiten oder Löschen trennen.", invalidCredentials:"Prüfen Sie die Feldnamen und tatsächlichen Zugangsdaten.", lastChecked:"Letzte Einstellungsprüfung", notChecked:"Nicht geprüft", verificationFailed:"Prüfen Sie den Verbindungsstatus und wiederholen Sie die Einstellungsprüfung.",
  },
} satisfies Record<SupportedLanguage, ConnectionCopy>;

export function connectionErrorMessage(error: unknown, copy: ConnectionCopy): string {
  const code = error instanceof Error ? error.message.split(":", 1)[0] : "";
  const messages: Record<string, string> = {
    CONNECTION_KEY_UNAVAILABLE: copy.keyUnavailable, CONNECTION_CREDENTIALS_UNAVAILABLE: copy.keyUnavailable,
    CONNECTION_TARGET_DUPLICATE: copy.duplicate, CONNECTION_ACTIVE: copy.disconnectFirst,
    INVALID_CREDENTIALS: copy.invalidCredentials, INVALID_CONNECTION: copy.invalidCredentials,
    CONNECTION_CREDENTIALS_REQUIRED: copy.invalidCredentials, CONNECTION_WORKER_UNAVAILABLE: copy.pending,
    CHANNEL_PACKET_RUNTIME_UNAVAILABLE: copy.pending,
  };
  return Object.hasOwn(messages, code) ? messages[code] : copy.error;
}
