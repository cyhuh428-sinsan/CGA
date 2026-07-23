import type { SupportedLanguage } from "@/lib/language";

export type ApiManagementCatalog = {
  search: string; filter: string; create: string; more: string; upload: string; downloadAll: string;
  downloadSelected: string; total: string; perPage: string; delete: string; selectAll: string; selectItem: string;
  category: string; apiName: string; baseUrl: string; methodCount: string; usedIntents: string; updatedAt: string;
  updatedBy: string; loading: string; empty: string; view: string; summary: string; edit: string; list: string;
  basic: string; description: string; createdAt: string; creator: string; methods: string; methodDescription: string;
  basicInfo: string; methodUrl: string; type: string; logging: string; proxy: string; transfer: string;
  sync: string; async: string; parameters: string; parameterDescription: string; parameterType: string;
  testInput: string; response: string; notFound: string; confirmDelete: string;
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
    response: "파라미터 응답", notFound: "API 정보를 찾을 수 없습니다.", confirmDelete: "API를 삭제하시겠습니까?",
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
    response: "Response Parameters", notFound: "API information was not found.", confirmDelete: "Delete this API?",
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
    response: "响应参数", notFound: "找不到 API 信息。", confirmDelete: "确定删除此 API 吗？",
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
    response: "応答パラメーター", notFound: "API 情報が見つかりません。", confirmDelete: "API を削除しますか？",
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
    response: "Tham số phản hồi", notFound: "Không tìm thấy thông tin API.", confirmDelete: "Xóa API này?",
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
    response: "Paramètres de réponse", notFound: "Informations API introuvables.", confirmDelete: "Supprimer cette API ?",
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
    response: "Antwortparameter", notFound: "API-Informationen wurden nicht gefunden.", confirmDelete: "Diese API löschen?",
  },
} satisfies Record<SupportedLanguage, ApiManagementCatalog>;
