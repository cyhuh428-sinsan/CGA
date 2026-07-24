import type { SupportedLanguage } from "@/lib/language";

export type ApiEditorCatalog = {
  region: string; intro: string; close: string; apiBasic: string; apiNamePlaceholder: string;
  descriptionPlaceholder: string; urlPlaceholder: string; collapse: string; addParameter: string;
  dataType: string; defaultValue: string; required: string; visible: string; max30: string;
  removeParameter: string; parameterEmpty: string; responseSettings: string; textEdit: string;
  sampleInput: string; removeMethod: string; addMethod: string; cancel: string; save: string;
  sampleTitle: string; samplePlaceholder: string; confirm: string; invalidJson: string;
};

export const API_EDITOR_CATALOGS = {
  ko: {
    region: "API 등록", intro: "API 메서드 정보를 입력하세요.", close: "닫기", apiBasic: "API 기본 정보",
    apiNamePlaceholder: "다른 사용자가 의미를 알 수 있게 입력해주세요.", descriptionPlaceholder: "API를 설명하는 문장을 입력하세요.",
    urlPlaceholder: "URL을 입력하세요. 예: http://{domain}:{port}", collapse: "접기", addParameter: "파라미터 추가",
    dataType: "데이터 유형", defaultValue: "기본값", required: "필수", visible: "보이기", max30: "최대 30자 입력",
    removeParameter: "파라미터 삭제", parameterEmpty: "파라미터를 추가하세요.", responseSettings: "파라미터 응답 설정",
    textEdit: "TEXT 편집", sampleInput: "Sample 입력", removeMethod: "삭제", addMethod: "메서드 추가",
    cancel: "취소", save: "저장", sampleTitle: "출력 sample로 입력하기",
    samplePlaceholder: "정상적인 API 호출 결과를 JSON 형식으로 입력하세요.", confirm: "확인",
    invalidJson: "JSON 형식에 맞지 않습니다. 정상적인 API 호출 결과를 입력하세요.",
  },
  en: {
    region: "Add API", intro: "Enter the API method information.", close: "Close", apiBasic: "API Basic Information",
    apiNamePlaceholder: "Enter a name other users can understand.", descriptionPlaceholder: "Enter a sentence describing the API.",
    urlPlaceholder: "Enter a URL. Example: http://{domain}:{port}", collapse: "Collapse", addParameter: "Add parameter",
    dataType: "Data type", defaultValue: "Default value", required: "Required", visible: "Visible", max30: "Up to 30 characters",
    removeParameter: "Remove parameter", parameterEmpty: "Add a parameter.", responseSettings: "Response Parameter Settings",
    textEdit: "Edit TEXT", sampleInput: "Enter sample", removeMethod: "Delete", addMethod: "Add method",
    cancel: "Cancel", save: "Save", sampleTitle: "Enter an output sample",
    samplePlaceholder: "Enter a valid API response in JSON format.", confirm: "Confirm",
    invalidJson: "The value is not valid JSON. Enter a valid API response.",
  },
  "zh-CN": {
    region: "注册 API", intro: "请输入 API 方法信息。", close: "关闭", apiBasic: "API 基本信息",
    apiNamePlaceholder: "请输入便于其他用户理解的名称。", descriptionPlaceholder: "请输入描述 API 的句子。",
    urlPlaceholder: "请输入 URL。例如：http://{domain}:{port}", collapse: "折叠", addParameter: "添加参数",
    dataType: "数据类型", defaultValue: "默认值", required: "必填", visible: "显示", max30: "最多 30 个字符",
    removeParameter: "删除参数", parameterEmpty: "请添加参数。", responseSettings: "响应参数设置",
    textEdit: "编辑 TEXT", sampleInput: "输入 Sample", removeMethod: "删除", addMethod: "添加方法",
    cancel: "取消", save: "保存", sampleTitle: "输入输出 sample",
    samplePlaceholder: "请以 JSON 格式输入有效的 API 调用结果。", confirm: "确认",
    invalidJson: "JSON 格式无效，请输入有效的 API 调用结果。",
  },
  ja: {
    region: "API 登録", intro: "API メソッド情報を入力してください。", close: "閉じる", apiBasic: "API 基本情報",
    apiNamePlaceholder: "他のユーザーにも分かる名前を入力してください。", descriptionPlaceholder: "API を説明する文を入力してください。",
    urlPlaceholder: "URL を入力してください。例: http://{domain}:{port}", collapse: "折りたたむ", addParameter: "パラメーター追加",
    dataType: "データ型", defaultValue: "デフォルト値", required: "必須", visible: "表示", max30: "最大 30 文字",
    removeParameter: "パラメーター削除", parameterEmpty: "パラメーターを追加してください。", responseSettings: "応答パラメーター設定",
    textEdit: "TEXT 編集", sampleInput: "Sample 入力", removeMethod: "削除", addMethod: "メソッド追加",
    cancel: "キャンセル", save: "保存", sampleTitle: "出力 sample を入力",
    samplePlaceholder: "正常な API 呼び出し結果を JSON 形式で入力してください。", confirm: "確認",
    invalidJson: "JSON 形式が正しくありません。正常な API 呼び出し結果を入力してください。",
  },
  vi: {
    region: "Đăng ký API", intro: "Nhập thông tin phương thức API.", close: "Đóng", apiBasic: "Thông tin cơ bản API",
    apiNamePlaceholder: "Nhập tên để người dùng khác dễ hiểu.", descriptionPlaceholder: "Nhập câu mô tả API.",
    urlPlaceholder: "Nhập URL. Ví dụ: http://{domain}:{port}", collapse: "Thu gọn", addParameter: "Thêm tham số",
    dataType: "Kiểu dữ liệu", defaultValue: "Giá trị mặc định", required: "Bắt buộc", visible: "Hiển thị", max30: "Tối đa 30 ký tự",
    removeParameter: "Xóa tham số", parameterEmpty: "Hãy thêm tham số.", responseSettings: "Cài đặt tham số phản hồi",
    textEdit: "Sửa TEXT", sampleInput: "Nhập Sample", removeMethod: "Xóa", addMethod: "Thêm phương thức",
    cancel: "Hủy", save: "Lưu", sampleTitle: "Nhập sample đầu ra",
    samplePlaceholder: "Nhập kết quả gọi API hợp lệ ở định dạng JSON.", confirm: "Xác nhận",
    invalidJson: "JSON không hợp lệ. Hãy nhập kết quả gọi API hợp lệ.",
  },
  fr: {
    region: "Ajouter une API", intro: "Saisissez les informations de la méthode API.", close: "Fermer", apiBasic: "Informations de base de l’API",
    apiNamePlaceholder: "Saisissez un nom compréhensible par les autres utilisateurs.", descriptionPlaceholder: "Saisissez une phrase décrivant l’API.",
    urlPlaceholder: "Saisissez une URL. Exemple : http://{domain}:{port}", collapse: "Réduire", addParameter: "Ajouter un paramètre",
    dataType: "Type de données", defaultValue: "Valeur par défaut", required: "Obligatoire", visible: "Visible", max30: "30 caractères maximum",
    removeParameter: "Supprimer le paramètre", parameterEmpty: "Ajoutez un paramètre.", responseSettings: "Paramètres de réponse",
    textEdit: "Modifier le TEXT", sampleInput: "Saisir un Sample", removeMethod: "Supprimer", addMethod: "Ajouter une méthode",
    cancel: "Annuler", save: "Enregistrer", sampleTitle: "Saisir un sample de sortie",
    samplePlaceholder: "Saisissez une réponse API valide au format JSON.", confirm: "Confirmer",
    invalidJson: "Le JSON est invalide. Saisissez une réponse API valide.",
  },
  de: {
    region: "API hinzufügen", intro: "Geben Sie die API-Methodeninformationen ein.", close: "Schließen", apiBasic: "API-Grundinformationen",
    apiNamePlaceholder: "Geben Sie einen verständlichen Namen ein.", descriptionPlaceholder: "Geben Sie einen Satz zur Beschreibung der API ein.",
    urlPlaceholder: "URL eingeben. Beispiel: http://{domain}:{port}", collapse: "Einklappen", addParameter: "Parameter hinzufügen",
    dataType: "Datentyp", defaultValue: "Standardwert", required: "Erforderlich", visible: "Sichtbar", max30: "Maximal 30 Zeichen",
    removeParameter: "Parameter löschen", parameterEmpty: "Fügen Sie einen Parameter hinzu.", responseSettings: "Antwortparameter-Einstellungen",
    textEdit: "TEXT bearbeiten", sampleInput: "Sample eingeben", removeMethod: "Löschen", addMethod: "Methode hinzufügen",
    cancel: "Abbrechen", save: "Speichern", sampleTitle: "Ausgabe-Sample eingeben",
    samplePlaceholder: "Geben Sie eine gültige API-Antwort im JSON-Format ein.", confirm: "Bestätigen",
    invalidJson: "Ungültiges JSON. Geben Sie eine gültige API-Antwort ein.",
  },
} satisfies Record<SupportedLanguage, ApiEditorCatalog>;
