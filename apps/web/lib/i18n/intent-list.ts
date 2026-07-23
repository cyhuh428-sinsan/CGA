import type { SupportedLanguage } from "@/lib/language";

export type IntentListCatalog = {
  intent: string;
  configure: string;
  entity: string;
  dictionary: string;
  evaluation: string;
  retraining: string;
  analysis: string;
  searchPlaceholder: string;
  filteringBy: string;
  all: string;
  category: string;
  validation: string;
  tag: string;
  module: string;
  success: string;
  failure: string;
  none: string;
  allValidation: string;
  allTags: string;
  addIntentModule: string;
  fileMenu: string;
  uploadFile: string;
  downloadFile: string;
  totalCount: string;
  pageSize: string;
  delete: string;
  selectedCount: string;
  selectAll: string;
  scenarioError: string;
  intentModuleName: string;
  displayName: string;
  utterances: string;
  conversationCards: string;
  otherOptions: string;
  modifiedAt: string;
  modifiedBy: string;
  selectRow: string;
  rowMenu: string;
  noSearchResults: string;
  loading: string;
  empty: string;
  pageLoading: string;
};

export function formatIntentListText(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export const INTENT_LIST_CATALOGS = {
  ko: { intent: "의도", configure: "구성", entity: "개체", dictionary: "사전", evaluation: "평가", retraining: "재학습", analysis: "분석", searchPlaceholder: "의도/모듈명, 학습문장, 대화카드, 의도아이디, 태그를 검색해주세요.", filteringBy: "{filter} 조건으로 조회 중입니다.", all: "전체", category: "구분", validation: "Validation", tag: "태그", module: "모듈", success: "성공", failure: "실패", none: "없음", allValidation: "전체 Validation", allTags: "전체 태그", addIntentModule: "+ 의도/모듈 추가", fileMenu: "의도/모듈 파일 메뉴", uploadFile: "파일 업로드", downloadFile: "파일 다운로드", totalCount: "전체 {count}건", pageSize: "{count}개씩 보기", delete: "삭제", selectedCount: "{count}개 선택", selectAll: "전체 선택", scenarioError: "오류", intentModuleName: "의도/모듈명", displayName: "표시명", utterances: "학습문장", conversationCards: "대화카드", otherOptions: "기타옵션", modifiedAt: "최종수정일시", modifiedBy: "최종수정자", selectRow: "{name} 선택", rowMenu: "{name} 메뉴", noSearchResults: "검색 조건에 맞는 의도/모듈이 없습니다.", loading: "의도/모듈 정보를 불러오는 중입니다.", empty: "등록된 의도/모듈이 없습니다. 먼저 의도/모듈을 추가해주세요.", pageLoading: "의도/모듈 화면을 불러오는 중입니다." },
  en: { intent: "Intent", configure: "Configuration", entity: "Entity", dictionary: "Dictionary", evaluation: "Evaluation", retraining: "Retraining", analysis: "Analysis", searchPlaceholder: "Search by intent/module name, training sentence, conversation card, intent ID, or tag.", filteringBy: "Filtering by {filter}.", all: "All", category: "Category", validation: "Validation", tag: "Tag", module: "Module", success: "Success", failure: "Failure", none: "None", allValidation: "All Validation", allTags: "All Tags", addIntentModule: "+ Add Intent/Module", fileMenu: "Intent/module file menu", uploadFile: "Upload File", downloadFile: "Download File", totalCount: "{count} total", pageSize: "{count} per page", delete: "Delete", selectedCount: "{count} selected", selectAll: "Select all", scenarioError: "Error", intentModuleName: "Intent/Module Name", displayName: "Display Name", utterances: "Training Sentences", conversationCards: "Conversation Cards", otherOptions: "Other Options", modifiedAt: "Last Modified", modifiedBy: "Modified By", selectRow: "Select {name}", rowMenu: "{name} menu", noSearchResults: "No intents or modules match the search criteria.", loading: "Loading intent/module information.", empty: "No intents or modules are registered. Add an intent or module first.", pageLoading: "Loading the intent/module screen." },
  "zh-CN": { intent: "意图", configure: "配置", entity: "实体", dictionary: "词典", evaluation: "评估", retraining: "重新训练", analysis: "分析", searchPlaceholder: "按意图/模块名称、训练语句、对话卡片、意图 ID 或标签搜索。", filteringBy: "正在按{filter}筛选。", all: "全部", category: "分类", validation: "验证", tag: "标签", module: "模块", success: "成功", failure: "失败", none: "无", allValidation: "全部验证", allTags: "全部标签", addIntentModule: "+ 添加意图/模块", fileMenu: "意图/模块文件菜单", uploadFile: "上传文件", downloadFile: "下载文件", totalCount: "共 {count} 条", pageSize: "每页 {count} 条", delete: "删除", selectedCount: "已选择 {count} 条", selectAll: "全选", scenarioError: "错误", intentModuleName: "意图/模块名称", displayName: "显示名称", utterances: "训练语句", conversationCards: "对话卡片", otherOptions: "其他选项", modifiedAt: "最后修改", modifiedBy: "修改人", selectRow: "选择{name}", rowMenu: "{name}菜单", noSearchResults: "没有符合搜索条件的意图或模块。", loading: "正在加载意图/模块信息。", empty: "尚未注册意图或模块。请先添加意图或模块。", pageLoading: "正在加载意图/模块页面。" },
  ja: { intent: "意図", configure: "構成", entity: "エンティティ", dictionary: "辞書", evaluation: "評価", retraining: "再学習", analysis: "分析", searchPlaceholder: "意図/モジュール名、学習文、対話カード、意図 ID、タグで検索してください。", filteringBy: "{filter}で絞り込み中です。", all: "すべて", category: "区分", validation: "検証", tag: "タグ", module: "モジュール", success: "成功", failure: "失敗", none: "なし", allValidation: "すべての検証", allTags: "すべてのタグ", addIntentModule: "+ 意図/モジュールを追加", fileMenu: "意図/モジュールのファイルメニュー", uploadFile: "ファイルをアップロード", downloadFile: "ファイルをダウンロード", totalCount: "全 {count} 件", pageSize: "{count}件ずつ表示", delete: "削除", selectedCount: "{count}件選択", selectAll: "すべて選択", scenarioError: "エラー", intentModuleName: "意図/モジュール名", displayName: "表示名", utterances: "学習文", conversationCards: "対話カード", otherOptions: "その他のオプション", modifiedAt: "最終更新日時", modifiedBy: "最終更新者", selectRow: "{name}を選択", rowMenu: "{name}のメニュー", noSearchResults: "検索条件に一致する意図/モジュールがありません。", loading: "意図/モジュール情報を読み込んでいます。", empty: "登録された意図/モジュールがありません。先に追加してください。", pageLoading: "意図/モジュール画面を読み込んでいます。" },
  vi: { intent: "Ý định", configure: "Cấu hình", entity: "Thực thể", dictionary: "Từ điển", evaluation: "Đánh giá", retraining: "Huấn luyện lại", analysis: "Phân tích", searchPlaceholder: "Tìm theo tên ý định/mô-đun, câu huấn luyện, thẻ hội thoại, ID ý định hoặc thẻ.", filteringBy: "Đang lọc theo {filter}.", all: "Tất cả", category: "Phân loại", validation: "Xác thực", tag: "Thẻ", module: "Mô-đun", success: "Thành công", failure: "Thất bại", none: "Không có", allValidation: "Tất cả xác thực", allTags: "Tất cả thẻ", addIntentModule: "+ Thêm ý định/mô-đun", fileMenu: "Menu tệp ý định/mô-đun", uploadFile: "Tải tệp lên", downloadFile: "Tải tệp xuống", totalCount: "Tổng {count}", pageSize: "{count} mỗi trang", delete: "Xóa", selectedCount: "Đã chọn {count}", selectAll: "Chọn tất cả", scenarioError: "Lỗi", intentModuleName: "Tên ý định/mô-đun", displayName: "Tên hiển thị", utterances: "Câu huấn luyện", conversationCards: "Thẻ hội thoại", otherOptions: "Tùy chọn khác", modifiedAt: "Sửa lần cuối", modifiedBy: "Người sửa", selectRow: "Chọn {name}", rowMenu: "Menu {name}", noSearchResults: "Không có ý định hoặc mô-đun phù hợp với điều kiện tìm kiếm.", loading: "Đang tải thông tin ý định/mô-đun.", empty: "Chưa có ý định hoặc mô-đun. Hãy thêm trước.", pageLoading: "Đang tải màn hình ý định/mô-đun." },
  fr: { intent: "Intention", configure: "Configuration", entity: "Entité", dictionary: "Dictionnaire", evaluation: "Évaluation", retraining: "Réentraînement", analysis: "Analyse", searchPlaceholder: "Recherchez par nom d'intention/module, phrase d'entraînement, carte de dialogue, ID ou tag.", filteringBy: "Filtrage par {filter}.", all: "Tous", category: "Catégorie", validation: "Validation", tag: "Tag", module: "Module", success: "Succès", failure: "Échec", none: "Aucun", allValidation: "Toutes les validations", allTags: "Tous les tags", addIntentModule: "+ Ajouter une intention/un module", fileMenu: "Menu des fichiers d'intention/module", uploadFile: "Importer un fichier", downloadFile: "Télécharger le fichier", totalCount: "{count} au total", pageSize: "{count} par page", delete: "Supprimer", selectedCount: "{count} sélectionnés", selectAll: "Tout sélectionner", scenarioError: "Erreur", intentModuleName: "Nom de l'intention/du module", displayName: "Nom affiché", utterances: "Phrases d'entraînement", conversationCards: "Cartes de dialogue", otherOptions: "Autres options", modifiedAt: "Dernière modification", modifiedBy: "Modifié par", selectRow: "Sélectionner {name}", rowMenu: "Menu de {name}", noSearchResults: "Aucune intention ni aucun module ne correspond aux critères.", loading: "Chargement des intentions/modules.", empty: "Aucune intention ni aucun module n'est enregistré. Ajoutez-en un d'abord.", pageLoading: "Chargement de l'écran des intentions/modules." },
  de: { intent: "Intent", configure: "Konfiguration", entity: "Entität", dictionary: "Wörterbuch", evaluation: "Bewertung", retraining: "Nachtraining", analysis: "Analyse", searchPlaceholder: "Nach Intent-/Modulname, Trainingssatz, Dialogkarte, Intent-ID oder Tag suchen.", filteringBy: "Filterung nach {filter}.", all: "Alle", category: "Kategorie", validation: "Validierung", tag: "Tag", module: "Modul", success: "Erfolg", failure: "Fehler", none: "Keine", allValidation: "Alle Validierungen", allTags: "Alle Tags", addIntentModule: "+ Intent/Modul hinzufügen", fileMenu: "Dateimenü für Intents/Module", uploadFile: "Datei hochladen", downloadFile: "Datei herunterladen", totalCount: "Insgesamt {count}", pageSize: "{count} pro Seite", delete: "Löschen", selectedCount: "{count} ausgewählt", selectAll: "Alle auswählen", scenarioError: "Fehler", intentModuleName: "Intent-/Modulname", displayName: "Anzeigename", utterances: "Trainingssätze", conversationCards: "Dialogkarten", otherOptions: "Weitere Optionen", modifiedAt: "Zuletzt geändert", modifiedBy: "Geändert von", selectRow: "{name} auswählen", rowMenu: "Menü für {name}", noSearchResults: "Keine Intents oder Module entsprechen den Suchkriterien.", loading: "Intent-/Modulinformationen werden geladen.", empty: "Es sind keine Intents oder Module registriert. Fügen Sie zuerst eines hinzu.", pageLoading: "Intent-/Modulansicht wird geladen." },
} satisfies Record<SupportedLanguage, IntentListCatalog>;
