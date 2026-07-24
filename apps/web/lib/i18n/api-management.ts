import type { SupportedLanguage } from "@/lib/language";

export type ApiManagementCatalog = {
  search: string; filter: string; create: string; more: string; upload: string; downloadAll: string;
  downloadSelected: string; total: string; perPage: string; delete: string; selectAll: string; selectItem: string;
  category: string; apiName: string; baseUrl: string; methodCount: string; usedIntents: string; updatedAt: string;
  updatedBy: string; loading: string; empty: string; view: string; summary: string; edit: string; list: string;
  basic: string; description: string; createdAt: string; creator: string; methods: string; methodDescription: string;
  basicInfo: string; methodUrl: string; type: string; logging: string; proxy: string; transfer: string;
  sync: string; async: string; parameters: string; parameterDescription: string; parameterType: string;
  testInput: string; response: string; notFound: string; confirmDelete: string; detailTitle: string; apiBasic: string; detailIntro: string; detailLoading: string; detailLoadFailed: string; updatedWithDesignNotice: string; updateFailed: string; deleteForbidden: string; deleteFailed: string; testFailed: string; name: string; dataType: string; testOutput: string; test: string; loadFailed: string; createForbidden: string; editForbidden: string; saveFailed: string; downloadSelectionRequired: string; downloadEmpty: string; downloadedSelected: string; downloadedAll: string; uploadEmpty: string; uploaded: string; uploadReadFailed: string; updated: string; created: string; deletedSelected: string;
};

export const API_MANAGEMENT_CATALOGS = {
  ko: {
    search: "API 이름, 상세설명, 목적지 Base URL을 검색하세요.", filter: "필터", create: "API 등록", more: "더보기",
    upload: "업로드", downloadAll: "전체 다운로드", downloadSelected: "선택 다운로드", total: "전체", perPage: "개씩 보기",
    delete: "삭제", selectAll: "전체 선택", selectItem: "선택", category: "구분", apiName: "API 이름",
    baseUrl: "목적지 Base URL", methodCount: "메서드 수", usedIntents: "사용중인 의도", updatedAt: "최종수정일시",
    updatedBy: "최종수정자", loading: "API 목록을 불러오는 중입니다...", empty: "등록된 API가 없습니다.",
    view: "API 조회", summary: "등록된 API 정보를 확인합니다.", edit: "수정", list: "목록", basic: "API 등록기본",
    description: "상세설명", createdAt: "생성일시", creator: "생성자", methods: "API 메서드",
    methodDescription: "메서드에 대한 상세 설명을 입력하세요.", basicInfo: "기본 정보", methodUrl: "메서드 URL",
    type: "유형", logging: "로깅", proxy: "프록시", transfer: "전송방식", sync: "동기", async: "비동기",
    parameters: "파라미터", parameterDescription: "설명", parameterType: "유형", testInput: "테스트 입력값",
    response: "파라미터 응답", notFound: "API 정보를 찾을 수 없습니다.", confirmDelete: "API를 삭제하시겠습니까?", loadFailed: "API 목록을 불러오지 못했습니다.", createForbidden: "API 등록 권한이 없습니다.", editForbidden: "API 수정 권한이 없습니다.", saveFailed: "API 저장 중 오류가 발생했습니다.", downloadSelectionRequired: "다운로드할 API를 선택해주세요.", downloadEmpty: "다운로드할 API가 없습니다.", downloadedSelected: "{count}개 API를 다운로드했습니다.", downloadedAll: "전체 API를 다운로드했습니다.", uploadEmpty: "업로드할 API 데이터가 없습니다.", uploaded: "{count}개 API를 업로드했습니다.", uploadReadFailed: "API 업로드 파일을 읽지 못했습니다.", updated: "API가 수정되었습니다.", created: "API가 등록되었습니다.", deletedSelected: "선택한 API가 삭제되었습니다.", detailTitle: "API 조회", apiBasic: "API 등록기본", detailIntro: "등록된 API 정보를 확인합니다.", detailLoading: "API 정보를 불러오는 중입니다.", detailLoadFailed: "API 정보를 불러오지 못했습니다.", updatedWithDesignNotice: "API가 수정되었습니다. 대화에 반영하려면 대화 설계 화면에서 한 번 더 저장하세요.", updateFailed: "API 수정 중 오류가 발생했습니다.", deleteForbidden: "API 삭제 권한이 없습니다.", deleteFailed: "API 삭제 중 오류가 발생했습니다.", testFailed: "API 테스트 중 오류가 발생했습니다.", name: "이름", dataType: "데이터 유형", testOutput: "테스트 출력", test: "테스트",
  },
  en: {
    search: "Search by API name, description, or destination Base URL.", filter: "Filter", create: "Add API", more: "More",
    upload: "Upload", downloadAll: "Download all", downloadSelected: "Download selected", total: "Total", perPage: "per page",
    delete: "Delete", selectAll: "Select all", selectItem: "Select", category: "Category", apiName: "API Name",
    baseUrl: "Destination Base URL", methodCount: "Methods", usedIntents: "Intents in use", updatedAt: "Last updated",
    updatedBy: "Updated by", loading: "Loading APIs...", empty: "No APIs are registered.", view: "API Details",
    summary: "Review the registered API information.", edit: "Edit", list: "List", basic: "API Basic Information",
    description: "Description", createdAt: "Created at", creator: "Created by", methods: "API Methods",
    methodDescription: "Enter a detailed description of the method.", basicInfo: "Basic Information", methodUrl: "Method URL",
    type: "Type", logging: "Logging", proxy: "Proxy", transfer: "Transfer", sync: "Synchronous", async: "Asynchronous",
    parameters: "Parameters", parameterDescription: "Description", parameterType: "Type", testInput: "Test value",
    response: "Response Parameters", notFound: "API information was not found.", confirmDelete: "Delete this API?", loadFailed: "Failed to load the API list.", createForbidden: "You do not have permission to add APIs.", editForbidden: "You do not have permission to edit APIs.", saveFailed: "An error occurred while saving the API.", downloadSelectionRequired: "Select APIs to download.", downloadEmpty: "There are no APIs to download.", downloadedSelected: "Downloaded {count} APIs.", downloadedAll: "Downloaded all APIs.", uploadEmpty: "The upload contains no API data.", uploaded: "Uploaded {count} APIs.", uploadReadFailed: "Failed to read the API upload file.", updated: "The API was updated.", created: "The API was added.", deletedSelected: "The selected APIs were deleted.", detailTitle: "View API", apiBasic: "API Registration Details", detailIntro: "View the registered API information.", detailLoading: "Loading API information.", detailLoadFailed: "Failed to load the API information.", updatedWithDesignNotice: "The API was updated. Save once more on the conversation design screen to apply it to conversations.", updateFailed: "An error occurred while updating the API.", deleteForbidden: "You do not have permission to delete APIs.", deleteFailed: "An error occurred while deleting the API.", testFailed: "An error occurred while testing the API.", name: "Name", dataType: "Data type", testOutput: "Test Output", test: "Test",
  },
  "zh-CN": {
    search: "按 API 名称、说明或目标 Base URL 搜索。", filter: "筛选", create: "注册 API", more: "更多",
    upload: "上传", downloadAll: "全部下载", downloadSelected: "下载所选", total: "全部", perPage: "条/页",
    delete: "删除", selectAll: "全选", selectItem: "选择", category: "分类", apiName: "API 名称",
    baseUrl: "目标 Base URL", methodCount: "方法数", usedIntents: "使用中的意图", updatedAt: "最后修改时间",
    updatedBy: "最后修改者", loading: "正在加载 API...", empty: "没有已注册的 API。", view: "查看 API",
    summary: "查看已注册的 API 信息。", edit: "修改", list: "列表", basic: "API 基本信息",
    description: "详细说明", createdAt: "创建时间", creator: "创建者", methods: "API 方法",
    methodDescription: "请输入方法的详细说明。", basicInfo: "基本信息", methodUrl: "方法 URL",
    type: "类型", logging: "日志", proxy: "代理", transfer: "传输方式", sync: "同步", async: "异步",
    parameters: "参数", parameterDescription: "说明", parameterType: "类型", testInput: "测试输入值",
    response: "响应参数", notFound: "找不到 API 信息。", confirmDelete: "确定删除此 API 吗？", loadFailed: "无法加载 API 列表。", createForbidden: "没有注册 API 的权限。", editForbidden: "没有修改 API 的权限。", saveFailed: "保存 API 时发生错误。", downloadSelectionRequired: "请选择要下载的 API。", downloadEmpty: "没有可下载的 API。", downloadedSelected: "已下载 {count} 个 API。", downloadedAll: "已下载全部 API。", uploadEmpty: "上传文件中没有 API 数据。", uploaded: "已上传 {count} 个 API。", uploadReadFailed: "无法读取 API 上传文件。", updated: "API 已修改。", created: "API 已注册。", deletedSelected: "所选 API 已删除。", detailTitle: "查看 API", apiBasic: "API 注册信息", detailIntro: "查看已注册的 API 信息。", detailLoading: "正在加载 API 信息。", detailLoadFailed: "无法加载 API 信息。", updatedWithDesignNotice: "API 已修改。要应用到对话，请在对话设计画面再次保存。", updateFailed: "修改 API 时发生错误。", deleteForbidden: "没有删除 API 的权限。", deleteFailed: "删除 API 时发生错误。", testFailed: "测试 API 时发生错误。", name: "名称", dataType: "数据类型", testOutput: "测试输出", test: "测试",
  },
  ja: {
    search: "API 名、詳細説明、宛先 Base URL を検索してください。", filter: "フィルター", create: "API 登録", more: "その他",
    upload: "アップロード", downloadAll: "すべてダウンロード", downloadSelected: "選択をダウンロード", total: "全件", perPage: "件表示",
    delete: "削除", selectAll: "すべて選択", selectItem: "選択", category: "区分", apiName: "API 名",
    baseUrl: "宛先 Base URL", methodCount: "メソッド数", usedIntents: "使用中のインテント", updatedAt: "最終更新日時",
    updatedBy: "最終更新者", loading: "API 一覧を読み込み中です...", empty: "登録された API はありません。", view: "API 照会",
    summary: "登録された API 情報を確認します。", edit: "修正", list: "一覧", basic: "API 基本情報",
    description: "詳細説明", createdAt: "作成日時", creator: "作成者", methods: "API メソッド",
    methodDescription: "メソッドの詳細説明を入力してください。", basicInfo: "基本情報", methodUrl: "メソッド URL",
    type: "種類", logging: "ロギング", proxy: "プロキシ", transfer: "転送方式", sync: "同期", async: "非同期",
    parameters: "パラメーター", parameterDescription: "説明", parameterType: "種類", testInput: "テスト入力値",
    response: "応答パラメーター", notFound: "API 情報が見つかりません。", confirmDelete: "API を削除しますか？", loadFailed: "API一覧を読み込めませんでした。", createForbidden: "APIを登録する権限がありません。", editForbidden: "APIを修正する権限がありません。", saveFailed: "APIの保存中にエラーが発生しました。", downloadSelectionRequired: "ダウンロードするAPIを選択してください。", downloadEmpty: "ダウンロードするAPIがありません。", downloadedSelected: "APIを{count}件ダウンロードしました。", downloadedAll: "すべてのAPIをダウンロードしました。", uploadEmpty: "アップロードするAPIデータがありません。", uploaded: "APIを{count}件アップロードしました。", uploadReadFailed: "APIアップロードファイルを読み込めませんでした。", updated: "APIを修正しました。", created: "APIを登録しました。", deletedSelected: "選択したAPIを削除しました。", detailTitle: "API 照会", apiBasic: "API 登録情報", detailIntro: "登録済みの API 情報を確認します。", detailLoading: "API 情報を読み込んでいます。", detailLoadFailed: "API 情報を読み込めませんでした。", updatedWithDesignNotice: "APIを修正しました。会話に反映するには、会話設計画面でもう一度保存してください。", updateFailed: "APIの修正中にエラーが発生しました。", deleteForbidden: "APIを削除する権限がありません。", deleteFailed: "APIの削除中にエラーが発生しました。", testFailed: "APIのテスト中にエラーが発生しました。", name: "名前", dataType: "データ型", testOutput: "テスト出力", test: "テスト",
  },
  vi: {
    search: "Tìm theo tên API, mô tả hoặc Base URL đích.", filter: "Bộ lọc", create: "Đăng ký API", more: "Thêm",
    upload: "Tải lên", downloadAll: "Tải xuống tất cả", downloadSelected: "Tải mục đã chọn", total: "Tổng", perPage: "mục/trang",
    delete: "Xóa", selectAll: "Chọn tất cả", selectItem: "Chọn", category: "Phân loại", apiName: "Tên API",
    baseUrl: "Base URL đích", methodCount: "Số phương thức", usedIntents: "Ý định đang dùng", updatedAt: "Cập nhật lần cuối",
    updatedBy: "Người cập nhật", loading: "Đang tải danh sách API...", empty: "Chưa có API nào.", view: "Chi tiết API",
    summary: "Xem thông tin API đã đăng ký.", edit: "Sửa", list: "Danh sách", basic: "Thông tin cơ bản API",
    description: "Mô tả", createdAt: "Ngày tạo", creator: "Người tạo", methods: "Phương thức API",
    methodDescription: "Nhập mô tả chi tiết cho phương thức.", basicInfo: "Thông tin cơ bản", methodUrl: "URL phương thức",
    type: "Loại", logging: "Ghi log", proxy: "Proxy", transfer: "Cách truyền", sync: "Đồng bộ", async: "Bất đồng bộ",
    parameters: "Tham số", parameterDescription: "Mô tả", parameterType: "Loại", testInput: "Giá trị kiểm thử",
    response: "Tham số phản hồi", notFound: "Không tìm thấy thông tin API.", confirmDelete: "Xóa API này?", loadFailed: "Không thể tải danh sách API.", createForbidden: "Bạn không có quyền đăng ký API.", editForbidden: "Bạn không có quyền sửa API.", saveFailed: "Đã xảy ra lỗi khi lưu API.", downloadSelectionRequired: "Chọn API cần tải xuống.", downloadEmpty: "Không có API để tải xuống.", downloadedSelected: "Đã tải xuống {count} API.", downloadedAll: "Đã tải xuống tất cả API.", uploadEmpty: "Không có dữ liệu API để tải lên.", uploaded: "Đã tải lên {count} API.", uploadReadFailed: "Không thể đọc tệp tải lên API.", updated: "Đã cập nhật API.", created: "Đã đăng ký API.", deletedSelected: "Đã xóa các API đã chọn.", detailTitle: "Xem API", apiBasic: "Thông tin đăng ký API", detailIntro: "Xem thông tin API đã đăng ký.", detailLoading: "Đang tải thông tin API.", detailLoadFailed: "Không thể tải thông tin API.", updatedWithDesignNotice: "Đã cập nhật API. Hãy lưu lại trên màn hình thiết kế hội thoại để áp dụng vào hội thoại.", updateFailed: "Đã xảy ra lỗi khi cập nhật API.", deleteForbidden: "Bạn không có quyền xóa API.", deleteFailed: "Đã xảy ra lỗi khi xóa API.", testFailed: "Đã xảy ra lỗi khi kiểm thử API.", name: "Tên", dataType: "Kiểu dữ liệu", testOutput: "Kết quả kiểm thử", test: "Kiểm thử",
  },
  fr: {
    search: "Rechercher par nom, description ou Base URL de destination.", filter: "Filtrer", create: "Ajouter une API", more: "Plus",
    upload: "Importer", downloadAll: "Tout télécharger", downloadSelected: "Télécharger la sélection", total: "Total", perPage: "par page",
    delete: "Supprimer", selectAll: "Tout sélectionner", selectItem: "Sélectionner", category: "Catégorie", apiName: "Nom de l’API",
    baseUrl: "Base URL de destination", methodCount: "Méthodes", usedIntents: "Intentions utilisées", updatedAt: "Dernière modification",
    updatedBy: "Modifié par", loading: "Chargement des API...", empty: "Aucune API enregistrée.", view: "Détails de l’API",
    summary: "Consultez les informations de l’API enregistrée.", edit: "Modifier", list: "Liste", basic: "Informations de base de l’API",
    description: "Description", createdAt: "Créée le", creator: "Créée par", methods: "Méthodes de l’API",
    methodDescription: "Saisissez une description détaillée de la méthode.", basicInfo: "Informations de base", methodUrl: "URL de la méthode",
    type: "Type", logging: "Journalisation", proxy: "Proxy", transfer: "Mode de transfert", sync: "Synchrone", async: "Asynchrone",
    parameters: "Paramètres", parameterDescription: "Description", parameterType: "Type", testInput: "Valeur de test",
    response: "Paramètres de réponse", notFound: "Informations API introuvables.", confirmDelete: "Supprimer cette API ?", loadFailed: "Impossible de charger la liste des API.", createForbidden: "Vous ne disposez pas du droit de créer des API.", editForbidden: "Vous ne disposez pas du droit de modifier des API.", saveFailed: "Une erreur est survenue lors de l’enregistrement de l’API.", downloadSelectionRequired: "Sélectionnez les API à télécharger.", downloadEmpty: "Aucune API à télécharger.", downloadedSelected: "{count} API ont été téléchargées.", downloadedAll: "Toutes les API ont été téléchargées.", uploadEmpty: "Le fichier ne contient aucune donnée API.", uploaded: "{count} API ont été importées.", uploadReadFailed: "Impossible de lire le fichier API.", updated: "L’API a été modifiée.", created: "L’API a été ajoutée.", deletedSelected: "Les API sélectionnées ont été supprimées.", detailTitle: "Consulter API", apiBasic: "Informations API", detailIntro: "Consultez les informations de cette API.", detailLoading: "Chargement des informations API.", detailLoadFailed: "Impossible de charger les informations API.", updatedWithDesignNotice: "API modifiée. Enregistrez-la à nouveau dans la conception du dialogue pour appliquer la modification.", updateFailed: "Une erreur est survenue pendant la modification de API.", deleteForbidden: "Vous ne disposez pas du droit de supprimer des API.", deleteFailed: "Une erreur est survenue pendant la suppression de API.", testFailed: "Une erreur est survenue pendant le test de API.", name: "Nom", dataType: "Type de données", testOutput: "Résultat du test", test: "Tester",
  },
  de: {
    search: "Nach API-Name, Beschreibung oder Ziel-Base-URL suchen.", filter: "Filter", create: "API hinzufügen", more: "Mehr",
    upload: "Hochladen", downloadAll: "Alle herunterladen", downloadSelected: "Auswahl herunterladen", total: "Gesamt", perPage: "pro Seite",
    delete: "Löschen", selectAll: "Alle auswählen", selectItem: "Auswählen", category: "Kategorie", apiName: "API-Name",
    baseUrl: "Ziel-Base-URL", methodCount: "Methoden", usedIntents: "Verwendete Intents", updatedAt: "Zuletzt geändert",
    updatedBy: "Geändert von", loading: "APIs werden geladen...", empty: "Keine APIs registriert.", view: "API-Details",
    summary: "Prüfen Sie die registrierten API-Informationen.", edit: "Bearbeiten", list: "Liste", basic: "API-Grundinformationen",
    description: "Beschreibung", createdAt: "Erstellt am", creator: "Erstellt von", methods: "API-Methoden",
    methodDescription: "Geben Sie eine detaillierte Methodenbeschreibung ein.", basicInfo: "Grundinformationen", methodUrl: "Methoden-URL",
    type: "Typ", logging: "Protokollierung", proxy: "Proxy", transfer: "Übertragung", sync: "Synchron", async: "Asynchron",
    parameters: "Parameter", parameterDescription: "Beschreibung", parameterType: "Typ", testInput: "Testwert",
    response: "Antwortparameter", notFound: "API-Informationen wurden nicht gefunden.", confirmDelete: "Diese API löschen?", loadFailed: "Die API-Liste konnte nicht geladen werden.", createForbidden: "Sie haben keine Berechtigung zum Hinzufügen von APIs.", editForbidden: "Sie haben keine Berechtigung zum Bearbeiten von APIs.", saveFailed: "Beim Speichern der API ist ein Fehler aufgetreten.", downloadSelectionRequired: "APIs zum Herunterladen auswählen.", downloadEmpty: "Keine APIs zum Herunterladen vorhanden.", downloadedSelected: "{count} APIs wurden heruntergeladen.", downloadedAll: "Alle APIs wurden heruntergeladen.", uploadEmpty: "Die Upload-Datei enthält keine API-Daten.", uploaded: "{count} APIs wurden hochgeladen.", uploadReadFailed: "Die API-Upload-Datei konnte nicht gelesen werden.", updated: "Die API wurde aktualisiert.", created: "Die API wurde hinzugefügt.", deletedSelected: "Die ausgewählten APIs wurden gelöscht.", detailTitle: "API anzeigen", apiBasic: "API-Registrierungsdetails", detailIntro: "Informationen zur registrierten API anzeigen.", detailLoading: "API-Informationen werden geladen.", detailLoadFailed: "Die API-Informationen konnten nicht geladen werden.", updatedWithDesignNotice: "Die API wurde aktualisiert. Speichern Sie sie im Dialogdesign erneut, um sie auf Dialoge anzuwenden.", updateFailed: "Beim Aktualisieren der API ist ein Fehler aufgetreten.", deleteForbidden: "Sie haben keine Berechtigung zum Löschen von APIs.", deleteFailed: "Beim Löschen der API ist ein Fehler aufgetreten.", testFailed: "Beim Testen der API ist ein Fehler aufgetreten.", name: "Name", dataType: "Datentyp", testOutput: "Testausgabe", test: "Test",
  },
} satisfies Record<SupportedLanguage, ApiManagementCatalog>;

export function formatApiManagementText(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
