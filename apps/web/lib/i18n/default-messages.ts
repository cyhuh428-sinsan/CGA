import type { SupportedLanguage } from "@/lib/language";

export type DefaultMessagesCatalog = {
  title: string; searchPlaceholder: string; columns: string[]; allCategory: string;
  categories: Record<"intent" | "input" | "error" | "session" | "runtime", string>;
  category: string; language: string; status: string; allStatus: string; active: string; inactive: string;
  reset: string; search: string; more: string; upload: string; download: string; editTitle: string;
  messageName: string; scope: string; global: string; group: string; message: string; description: string;
  restore: string; cancel: string; save: string; loading: string; loginRequired: string; loadFailed: string;
  saved: string; saveFailed: string; restored: string; restoreFailed: string; uploadFailed: string;
  uploadResult: string; totalCount: string; fileName: string;
};

export const DEFAULT_MESSAGES_CATALOGS = {
  ko: {
    title: "기본 메시지 관리", searchPlaceholder: "메시지명 또는 메시지 내용을 검색하세요.",
    columns: ["구분", "메시지명", "언어", "적용 범위", "사용여부", "메시지", "최종수정일시", "최종수정자"],
    allCategory: "전체 구분", categories: { intent: "의도", input: "입력", error: "오류", session: "세션", runtime: "런타임" },
    category: "구분", language: "언어", status: "사용여부", allStatus: "전체 사용여부", active: "사용", inactive: "미사용",
    reset: "초기화", search: "조회", more: "기본 메시지 더보기", upload: "파일 업로드", download: "파일 다운로드",
    editTitle: "기본 메시지 수정", messageName: "메시지명", scope: "적용 범위", global: "전체", group: "그룹",
    message: "메시지", description: "설명", restore: "기본값 복원", cancel: "취소", save: "저장",
    loading: "불러오는 중", loginRequired: "로그인이 필요합니다.", loadFailed: "기본 메시지를 불러오지 못했습니다.",
    saved: "기본 메시지가 저장되었습니다.", saveFailed: "기본 메시지 저장에 실패했습니다.",
    restored: "기본 메시지가 기본값으로 복원되었습니다.", restoreFailed: "기본 메시지 복원에 실패했습니다.",
    uploadFailed: "기본 메시지 업로드에 실패했습니다.", uploadResult: "{saved}건 반영, {skipped}건 제외되었습니다.",
    totalCount: "전체 {count}건", fileName: "기본 메시지 관리.csv",
  },
  en: {
    title: "Default Messages", searchPlaceholder: "Search by message name or content.",
    columns: ["Category", "Message Name", "Language", "Scope", "Status", "Message", "Updated At", "Updated By"],
    allCategory: "All categories", categories: { intent: "Intent", input: "Input", error: "Error", session: "Session", runtime: "Runtime" },
    category: "Category", language: "Language", status: "Status", allStatus: "All statuses", active: "Active", inactive: "Inactive",
    reset: "Reset", search: "Search", more: "More default-message actions", upload: "Upload file", download: "Download file",
    editTitle: "Edit Default Message", messageName: "Message Name", scope: "Scope", global: "Global", group: "Group",
    message: "Message", description: "Description", restore: "Restore default", cancel: "Cancel", save: "Save",
    loading: "Loading", loginRequired: "Login is required.", loadFailed: "Failed to load default messages.",
    saved: "Default message saved.", saveFailed: "Failed to save the default message.",
    restored: "Default message restored.", restoreFailed: "Failed to restore the default message.",
    uploadFailed: "Failed to upload default messages.", uploadResult: "{saved} applied, {skipped} skipped.",
    totalCount: "Total {count}", fileName: "default-messages.csv",
  },
  "zh-CN": {
    title: "默认消息管理", searchPlaceholder: "按消息名称或内容搜索。",
    columns: ["类别", "消息名称", "语言", "适用范围", "状态", "消息", "修改时间", "修改者"],
    allCategory: "所有类别", categories: { intent: "意图", input: "输入", error: "错误", session: "会话", runtime: "运行时" },
    category: "类别", language: "语言", status: "状态", allStatus: "所有状态", active: "启用", inactive: "停用",
    reset: "重置", search: "查询", more: "更多默认消息操作", upload: "上传文件", download: "下载文件",
    editTitle: "编辑默认消息", messageName: "消息名称", scope: "适用范围", global: "全部", group: "组",
    message: "消息", description: "说明", restore: "恢复默认值", cancel: "取消", save: "保存",
    loading: "加载中", loginRequired: "需要登录。", loadFailed: "无法加载默认消息。",
    saved: "默认消息已保存。", saveFailed: "保存默认消息失败。", restored: "默认消息已恢复。",
    restoreFailed: "恢复默认消息失败。", uploadFailed: "上传默认消息失败。",
    uploadResult: "已应用 {saved} 条，跳过 {skipped} 条。", totalCount: "共 {count} 条", fileName: "默认消息.csv",
  },
  ja: {
    title: "デフォルトメッセージ管理", searchPlaceholder: "メッセージ名または内容で検索します。",
    columns: ["区分", "メッセージ名", "言語", "適用範囲", "使用状態", "メッセージ", "更新日時", "更新者"],
    allCategory: "すべての区分", categories: { intent: "インテント", input: "入力", error: "エラー", session: "セッション", runtime: "ランタイム" },
    category: "区分", language: "言語", status: "使用状態", allStatus: "すべての状態", active: "使用", inactive: "未使用",
    reset: "リセット", search: "照会", more: "デフォルトメッセージのその他操作", upload: "ファイルアップロード", download: "ファイルダウンロード",
    editTitle: "デフォルトメッセージ編集", messageName: "メッセージ名", scope: "適用範囲", global: "全体", group: "グループ",
    message: "メッセージ", description: "説明", restore: "デフォルトに戻す", cancel: "キャンセル", save: "保存",
    loading: "読み込み中", loginRequired: "ログインが必要です。", loadFailed: "デフォルトメッセージを読み込めませんでした。",
    saved: "デフォルトメッセージを保存しました。", saveFailed: "保存に失敗しました。", restored: "デフォルトに戻しました。",
    restoreFailed: "復元に失敗しました。", uploadFailed: "アップロードに失敗しました。",
    uploadResult: "{saved}件反映、{skipped}件除外しました。", totalCount: "全 {count} 件", fileName: "デフォルトメッセージ.csv",
  },
  vi: {
    title: "Quản lý tin nhắn mặc định", searchPlaceholder: "Tìm theo tên hoặc nội dung tin nhắn.",
    columns: ["Loại", "Tên tin nhắn", "Ngôn ngữ", "Phạm vi", "Trạng thái", "Tin nhắn", "Cập nhật", "Người cập nhật"],
    allCategory: "Tất cả loại", categories: { intent: "Ý định", input: "Đầu vào", error: "Lỗi", session: "Phiên", runtime: "Thời gian chạy" },
    category: "Loại", language: "Ngôn ngữ", status: "Trạng thái", allStatus: "Tất cả trạng thái", active: "Sử dụng", inactive: "Không sử dụng",
    reset: "Đặt lại", search: "Tra cứu", more: "Thêm thao tác", upload: "Tải tệp lên", download: "Tải tệp xuống",
    editTitle: "Sửa tin nhắn mặc định", messageName: "Tên tin nhắn", scope: "Phạm vi", global: "Toàn bộ", group: "Nhóm",
    message: "Tin nhắn", description: "Mô tả", restore: "Khôi phục mặc định", cancel: "Hủy", save: "Lưu",
    loading: "Đang tải", loginRequired: "Cần đăng nhập.", loadFailed: "Không thể tải tin nhắn mặc định.",
    saved: "Đã lưu tin nhắn mặc định.", saveFailed: "Không thể lưu tin nhắn.", restored: "Đã khôi phục mặc định.",
    restoreFailed: "Không thể khôi phục.", uploadFailed: "Không thể tải lên.",
    uploadResult: "Đã áp dụng {saved}, bỏ qua {skipped}.", totalCount: "Tổng {count}", fileName: "tin-nhan-mac-dinh.csv",
  },
  fr: {
    title: "Messages par défaut", searchPlaceholder: "Rechercher par nom ou contenu du message.",
    columns: ["Catégorie", "Nom", "Langue", "Portée", "État", "Message", "Modifié le", "Modifié par"],
    allCategory: "Toutes les catégories", categories: { intent: "Intention", input: "Entrée", error: "Erreur", session: "Session", runtime: "Exécution" },
    category: "Catégorie", language: "Langue", status: "État", allStatus: "Tous les états", active: "Actif", inactive: "Inactif",
    reset: "Réinitialiser", search: "Rechercher", more: "Autres actions", upload: "Importer un fichier", download: "Télécharger le fichier",
    editTitle: "Modifier le message par défaut", messageName: "Nom du message", scope: "Portée", global: "Globale", group: "Groupe",
    message: "Message", description: "Description", restore: "Rétablir la valeur par défaut", cancel: "Annuler", save: "Enregistrer",
    loading: "Chargement", loginRequired: "Connexion requise.", loadFailed: "Impossible de charger les messages.",
    saved: "Message enregistré.", saveFailed: "Échec de l’enregistrement.", restored: "Message rétabli.",
    restoreFailed: "Échec du rétablissement.", uploadFailed: "Échec de l’importation.",
    uploadResult: "{saved} appliqués, {skipped} ignorés.", totalCount: "Total {count}", fileName: "messages-par-defaut.csv",
  },
  de: {
    title: "Standardnachrichten", searchPlaceholder: "Nach Nachrichtenname oder Inhalt suchen.",
    columns: ["Kategorie", "Nachrichtenname", "Sprache", "Bereich", "Status", "Nachricht", "Aktualisiert", "Aktualisiert von"],
    allCategory: "Alle Kategorien", categories: { intent: "Intent", input: "Eingabe", error: "Fehler", session: "Sitzung", runtime: "Laufzeit" },
    category: "Kategorie", language: "Sprache", status: "Status", allStatus: "Alle Status", active: "Aktiv", inactive: "Inaktiv",
    reset: "Zurücksetzen", search: "Suchen", more: "Weitere Aktionen", upload: "Datei hochladen", download: "Datei herunterladen",
    editTitle: "Standardnachricht bearbeiten", messageName: "Nachrichtenname", scope: "Bereich", global: "Global", group: "Gruppe",
    message: "Nachricht", description: "Beschreibung", restore: "Standard wiederherstellen", cancel: "Abbrechen", save: "Speichern",
    loading: "Wird geladen", loginRequired: "Anmeldung erforderlich.", loadFailed: "Standardnachrichten konnten nicht geladen werden.",
    saved: "Standardnachricht gespeichert.", saveFailed: "Speichern fehlgeschlagen.", restored: "Standard wiederhergestellt.",
    restoreFailed: "Wiederherstellung fehlgeschlagen.", uploadFailed: "Upload fehlgeschlagen.",
    uploadResult: "{saved} übernommen, {skipped} übersprungen.", totalCount: "Gesamt {count}", fileName: "standardnachrichten.csv",
  },
} satisfies Record<SupportedLanguage, DefaultMessagesCatalog>;

export function formatDefaultMessageText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
