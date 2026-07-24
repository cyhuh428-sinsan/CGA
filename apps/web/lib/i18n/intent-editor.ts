import type { SupportedLanguage } from "@/lib/language";

export type IntentEditorCatalog = {
  helpAria: string;
  intent: string;
  module: string;
  createTitle: string;
  editTitle: string;
  requiredHint: string;
  category: string;
  nameLabel: string;
  namePlaceholder: string;
  nameGuide: string;
  displayName: string;
  displayNamePlaceholder: string;
  dialogKey: string;
  dialogKeyDescription: string;
  dialogKeyGuide: string;
  transitionLocked: string;
  transitionLockedDescription: string;
  returnBlocked: string;
  returnBlockedDescription: string;
  feedbackEnabled: string;
  feedbackEnabledDescription: string;
  feedbackLocked: string;
  feedbackModeNone: string;
  feedbackModeAll: string;
  llmPrompt: string;
  llmPromptDescription: string;
  llmPromptPlaceholder: string;
  llmPromptFallback: string;
  tags: string;
  tagsDescription: string;
  tagsPlaceholder: string;
  tagsGuide: string;
  close: string;
  cancel: string;
  saving: string;
  confirm: string;
  created: string;
  updated: string;
  validation: {
    maxTags: string;
    noActiveVersion: string;
    nameRequired: string;
    duplicateName: string;
    duplicateKey: string;
    saveFailed: string;
  };
};

export const INTENT_EDITOR_CATALOGS = {
  ko: {
    helpAria: "{label} 설명", intent: "의도", module: "모듈", createTitle: "{type} 생성", editTitle: "{type} 수정", requiredHint: "의도명, 표시명, 의도 Key는 필수값입니다.", category: "구분", nameLabel: "{type}명", namePlaceholder: "{type}명을 입력하세요.", nameGuide: "한글/영문/숫자/공백/특수문자/-.()로만 입력", displayName: "표시명", displayNamePlaceholder: "표시명을 입력하세요.", dialogKey: "의도 Key", dialogKeyDescription: "의도/모듈을 내부적으로 식별하는 키입니다. 나중에 엔진이나 외부 연동에서 이름 대신 안정적으로 참조할 수 있도록 유지됩니다.", dialogKeyGuide: "영문/숫자/특수문자/_(밑줄)로만 입력", transitionLocked: "의도전환잠금", transitionLockedDescription: "의도에 진입한 뒤에는 시나리오 진행 중 다른 의도로 전환되지 않도록 잠그는 설정입니다. 특정 의도에서 설계한 대화를 반드시 완결해야 할 때 사용합니다.", returnBlocked: "의도복귀차단", returnBlockedDescription: "현재 의도 진행 중 다른 의도로 진입하게 되면, 다시 현재 의도로 복귀하지 않도록 막는 설정입니다.", feedbackEnabled: "의도별 피드백", feedbackEnabledDescription: "해당 의도 시나리오가 끝난 뒤 사용자가 점수로 평가할 수 있도록 하는 설정입니다. 실제 피드백 메시지와 척도는 봇 설정의 메시지 설정을 따릅니다.", feedbackLocked: "봇 설정의 메시지 설정에서 피드백 사용 유형이 {mode}으로 설정되어 있어 여기서는 변경할 수 없습니다.", feedbackModeNone: "`사용 안함`", feedbackModeAll: "`모든 의도 사용`", llmPrompt: "LLM 답변 프롬프트", llmPromptDescription: "이 의도에 진입했을 때 LLM Engine 답변과 LLM Engine RAG 답변 생성에 우선 적용할 지시문입니다. 비워두면 봇 설정의 기본 프롬프트를 사용합니다.", llmPromptPlaceholder: "이 의도에서 LLM이 답변을 생성할 때 따를 말투, 형식, 제한사항을 입력하세요.", llmPromptFallback: "비워두면 봇 설정의 기본 LLM 답변 프롬프트를 사용합니다.", tags: "태그", tagsDescription: "유사한 성격의 의도들을 묶어서 조회하고 관리하기 위한 값입니다. 새로운 태그를 입력하고 Enter를 누르면 등록됩니다.", tagsPlaceholder: "태그를 입력하고 엔터키를 눌러주세요.", tagsGuide: "한글/영문/숫자/공백으로만 입력, 10개까지 입력 가능", close: "닫기", cancel: "취소", saving: "저장 중...", confirm: "확인", created: "{type}이 등록되었습니다.", updated: "{type} 기본 정보가 수정되었습니다.",
    validation: { maxTags: "태그는 최대 10개까지 등록할 수 있습니다.", noActiveVersion: "활성 버전이 없습니다.", nameRequired: "의도/모듈명을 입력해주세요.", duplicateName: "이미 사용 중인 의도/모듈명입니다.", duplicateKey: "이미 사용 중인 의도 Key 입니다.", saveFailed: "의도/모듈을 저장하지 못했습니다." },
  },
  en: {
    helpAria: "About {label}", intent: "Intent", module: "Module", createTitle: "Create {type}", editTitle: "Edit {type}", requiredHint: "Intent/module name, display name, and intent key are required.", category: "Category", nameLabel: "{type} Name", namePlaceholder: "Enter the {type} name.", nameGuide: "Use letters, numbers, spaces, and the special characters /-.()", displayName: "Display Name", displayNamePlaceholder: "Enter the display name.", dialogKey: "Intent Key", dialogKeyDescription: "A stable key used internally to identify the intent/module and reference it from engines or external integrations.", dialogKeyGuide: "Use letters, numbers, special characters, and underscore (_)", transitionLocked: "Lock Intent Transition", transitionLockedDescription: "Prevents transitions to other intents while this scenario is in progress, so the designed conversation must be completed.", returnBlocked: "Block Intent Return", returnBlockedDescription: "Prevents returning to the current intent after entering another intent during this scenario.", feedbackEnabled: "Feedback by Intent", feedbackEnabledDescription: "Allows users to rate the completed intent scenario. Messages and scales follow the bot message settings.", feedbackLocked: "The feedback mode is set to {mode} in bot message settings, so it cannot be changed here.", feedbackModeNone: "`Disabled`", feedbackModeAll: "`All intents`", llmPrompt: "LLM Answer Prompt", llmPromptDescription: "Instructions applied first when generating LLM or LLM RAG answers for this intent. Leave blank to use the bot default prompt.", llmPromptPlaceholder: "Enter the tone, format, and restrictions for LLM answers in this intent.", llmPromptFallback: "Leave blank to use the bot default LLM answer prompt.", tags: "Tags", tagsDescription: "Values used to group and manage similar intents. Enter a new tag and press Enter to add it.", tagsPlaceholder: "Enter a tag and press Enter.", tagsGuide: "Use letters, numbers, and spaces; up to 10 tags", close: "Close", cancel: "Cancel", saving: "Saving...", confirm: "Confirm", created: "{type} was created.", updated: "{type} basic information was updated.",
    validation: { maxTags: "You can register up to 10 tags.", noActiveVersion: "There is no active version.", nameRequired: "Enter an intent/module name.", duplicateName: "That intent/module name is already in use.", duplicateKey: "That intent key is already in use.", saveFailed: "Failed to save the intent/module." },
  },
  "zh-CN": {
    helpAria: "{label}说明", intent: "意图", module: "模块", createTitle: "创建{type}", editTitle: "编辑{type}", requiredHint: "意图/模块名称、显示名称和意图Key为必填项。", category: "分类", nameLabel: "{type}名称", namePlaceholder: "请输入{type}名称。", nameGuide: "仅可使用文字、数字、空格及特殊字符/-.()", displayName: "显示名称", displayNamePlaceholder: "请输入显示名称。", dialogKey: "意图 Key", dialogKeyDescription: "用于内部识别意图/模块的稳定键，供引擎或外部集成引用。", dialogKeyGuide: "仅可使用英文字母、数字、特殊字符和下划线(_)", transitionLocked: "锁定意图切换", transitionLockedDescription: "进入意图后，在场景进行期间禁止切换到其他意图，确保完成当前对话。", returnBlocked: "阻止返回意图", returnBlockedDescription: "当前意图进行中进入其他意图后，阻止再次返回当前意图。", feedbackEnabled: "按意图反馈", feedbackEnabledDescription: "意图场景结束后允许用户评分，反馈消息和量表遵循机器人消息设置。", feedbackLocked: "机器人消息设置中的反馈模式为{mode}，因此无法在此更改。", feedbackModeNone: "`不使用`", feedbackModeAll: "`所有意图`", llmPrompt: "LLM回答提示词", llmPromptDescription: "进入此意图时优先用于生成LLM及LLM RAG回答的指令。留空则使用机器人默认提示词。", llmPromptPlaceholder: "请输入此意图中LLM回答的语气、格式和限制。", llmPromptFallback: "留空则使用机器人的默认LLM回答提示词。", tags: "标签", tagsDescription: "用于分组和管理相似意图。输入新标签并按Enter即可添加。", tagsPlaceholder: "输入标签并按Enter。", tagsGuide: "仅可使用文字、数字和空格，最多10个", close: "关闭", cancel: "取消", saving: "保存中...", confirm: "确认", created: "{type}已创建。", updated: "{type}基本信息已更新。",
    validation: { maxTags: "最多可以注册10个标签。", noActiveVersion: "没有活动版本。", nameRequired: "请输入意图/模块名称。", duplicateName: "该意图/模块名称已被使用。", duplicateKey: "该意图Key已被使用。", saveFailed: "无法保存意图/模块。" },
  },
  ja: {
    helpAria: "{label}の説明", intent: "意図", module: "モジュール", createTitle: "{type}を作成", editTitle: "{type}を編集", requiredHint: "意図/モジュール名、表示名、意図Keyは必須です。", category: "区分", nameLabel: "{type}名", namePlaceholder: "{type}名を入力してください。", nameGuide: "文字、数字、空白、特殊文字/-.()のみ使用できます", displayName: "表示名", displayNamePlaceholder: "表示名を入力してください。", dialogKey: "意図 Key", dialogKeyDescription: "意図/モジュールを内部で識別し、エンジンや外部連携から安定して参照するためのキーです。", dialogKeyGuide: "英字、数字、特殊文字、アンダースコア(_)のみ使用できます", transitionLocked: "意図遷移ロック", transitionLockedDescription: "意図に入った後、シナリオ中に他の意図へ遷移しないようロックし、設計した会話を完了させます。", returnBlocked: "意図復帰ブロック", returnBlockedDescription: "現在の意図中に他の意図へ入った場合、現在の意図へ戻らないようにします。", feedbackEnabled: "意図別フィードバック", feedbackEnabledDescription: "意図シナリオ終了後にユーザーが評価できます。メッセージと尺度はボット設定に従います。", feedbackLocked: "ボットのメッセージ設定でフィードバックモードが{mode}のため、ここでは変更できません。", feedbackModeNone: "`使用しない`", feedbackModeAll: "`すべての意図`", llmPrompt: "LLM回答プロンプト", llmPromptDescription: "この意図のLLMおよびLLM RAG回答生成に優先適用する指示です。空欄の場合はボットの既定プロンプトを使用します。", llmPromptPlaceholder: "この意図でのLLM回答の口調、形式、制限を入力してください。", llmPromptFallback: "空欄の場合はボットの既定LLM回答プロンプトを使用します。", tags: "タグ", tagsDescription: "類似する意図をまとめて管理する値です。新しいタグを入力してEnterを押すと追加されます。", tagsPlaceholder: "タグを入力してEnterを押してください。", tagsGuide: "文字、数字、空白のみ、最大10件", close: "閉じる", cancel: "キャンセル", saving: "保存中...", confirm: "確認", created: "{type}を登録しました。", updated: "{type}の基本情報を更新しました。",
    validation: { maxTags: "タグは最大10件まで登録できます。", noActiveVersion: "アクティブなバージョンがありません。", nameRequired: "意図/モジュール名を入力してください。", duplicateName: "その意図/モジュール名はすでに使用されています。", duplicateKey: "その意図Keyはすでに使用されています。", saveFailed: "意図/モジュールを保存できませんでした。" },
  },
  vi: {
    helpAria: "Giải thích {label}", intent: "Ý định", module: "Mô-đun", createTitle: "Tạo {type}", editTitle: "Sửa {type}", requiredHint: "Tên ý định/mô-đun, tên hiển thị và Key ý định là bắt buộc.", category: "Phân loại", nameLabel: "Tên {type}", namePlaceholder: "Nhập tên {type}.", nameGuide: "Chỉ dùng chữ, số, khoảng trắng và ký tự đặc biệt /-.()", displayName: "Tên hiển thị", displayNamePlaceholder: "Nhập tên hiển thị.", dialogKey: "Key ý định", dialogKeyDescription: "Khóa ổn định để nhận diện nội bộ ý định/mô-đun và tham chiếu từ engine hoặc tích hợp ngoài.", dialogKeyGuide: "Chỉ dùng chữ cái, số, ký tự đặc biệt và gạch dưới (_)", transitionLocked: "Khóa chuyển ý định", transitionLockedDescription: "Ngăn chuyển sang ý định khác trong khi kịch bản đang chạy để hoàn tất hội thoại đã thiết kế.", returnBlocked: "Chặn quay lại ý định", returnBlockedDescription: "Ngăn quay lại ý định hiện tại sau khi đã vào ý định khác trong kịch bản.", feedbackEnabled: "Phản hồi theo ý định", feedbackEnabledDescription: "Cho phép người dùng đánh giá sau khi hoàn tất kịch bản. Tin nhắn và thang điểm theo cài đặt bot.", feedbackLocked: "Chế độ phản hồi trong cài đặt tin nhắn bot là {mode}, nên không thể đổi tại đây.", feedbackModeNone: "`Không dùng`", feedbackModeAll: "`Tất cả ý định`", llmPrompt: "Prompt trả lời LLM", llmPromptDescription: "Chỉ dẫn ưu tiên khi tạo câu trả lời LLM hoặc LLM RAG cho ý định này. Để trống để dùng prompt mặc định của bot.", llmPromptPlaceholder: "Nhập giọng điệu, định dạng và giới hạn cho câu trả lời LLM trong ý định này.", llmPromptFallback: "Để trống để dùng prompt trả lời LLM mặc định của bot.", tags: "Thẻ", tagsDescription: "Giá trị để nhóm và quản lý các ý định tương tự. Nhập thẻ mới và nhấn Enter để thêm.", tagsPlaceholder: "Nhập thẻ và nhấn Enter.", tagsGuide: "Chỉ dùng chữ, số và khoảng trắng; tối đa 10 thẻ", close: "Đóng", cancel: "Hủy", saving: "Đang lưu...", confirm: "Xác nhận", created: "Đã tạo {type}.", updated: "Đã cập nhật thông tin cơ bản của {type}.",
    validation: { maxTags: "Có thể đăng ký tối đa 10 thẻ.", noActiveVersion: "Không có phiên bản đang hoạt động.", nameRequired: "Nhập tên ý định/mô-đun.", duplicateName: "Tên ý định/mô-đun này đã được sử dụng.", duplicateKey: "Key ý định này đã được sử dụng.", saveFailed: "Không thể lưu ý định/mô-đun." },
  },
  fr: {
    helpAria: "À propos de {label}", intent: "Intention", module: "Module", createTitle: "Créer {type}", editTitle: "Modifier {type}", requiredHint: "Le nom de l’intention/du module, le nom affiché et la clé d’intention sont obligatoires.", category: "Catégorie", nameLabel: "Nom de {type}", namePlaceholder: "Saisissez le nom de {type}.", nameGuide: "Utilisez lettres, chiffres, espaces et caractères spéciaux /-.()", displayName: "Nom affiché", displayNamePlaceholder: "Saisissez le nom affiché.", dialogKey: "Clé d’intention", dialogKeyDescription: "Clé stable d’identification interne de l’intention/du module, utilisée par les moteurs et intégrations externes.", dialogKeyGuide: "Utilisez lettres, chiffres, caractères spéciaux et trait de soulignement (_)", transitionLocked: "Verrouiller la transition", transitionLockedDescription: "Empêche le passage à une autre intention pendant le scénario afin d’achever la conversation conçue.", returnBlocked: "Bloquer le retour", returnBlockedDescription: "Empêche le retour à l’intention actuelle après l’entrée dans une autre intention.", feedbackEnabled: "Feedback par intention", feedbackEnabledDescription: "Permet à l’utilisateur d’évaluer le scénario terminé. Les messages et l’échelle suivent les paramètres du bot.", feedbackLocked: "Le mode de feedback est défini sur {mode} dans les paramètres du bot et ne peut pas être modifié ici.", feedbackModeNone: "`Désactivé`", feedbackModeAll: "`Toutes les intentions`", llmPrompt: "Prompt de réponse LLM", llmPromptDescription: "Instructions prioritaires pour les réponses LLM ou LLM RAG de cette intention. Laissez vide pour utiliser le prompt par défaut du bot.", llmPromptPlaceholder: "Saisissez le ton, le format et les restrictions des réponses LLM de cette intention.", llmPromptFallback: "Laissez vide pour utiliser le prompt de réponse LLM par défaut du bot.", tags: "Tags", tagsDescription: "Valeurs servant à regrouper et gérer les intentions similaires. Saisissez un tag puis appuyez sur Entrée.", tagsPlaceholder: "Saisissez un tag puis appuyez sur Entrée.", tagsGuide: "Lettres, chiffres et espaces uniquement ; 10 tags maximum", close: "Fermer", cancel: "Annuler", saving: "Enregistrement...", confirm: "Confirmer", created: "{type} créée.", updated: "Informations de base de {type} mises à jour.",
    validation: { maxTags: "Vous pouvez enregistrer jusqu’à 10 tags.", noActiveVersion: "Aucune version active.", nameRequired: "Saisissez un nom d’intention/de module.", duplicateName: "Ce nom d’intention/de module est déjà utilisé.", duplicateKey: "Cette clé d’intention est déjà utilisée.", saveFailed: "Impossible d’enregistrer l’intention/le module." },
  },
  de: {
    helpAria: "Informationen zu {label}", intent: "Intent", module: "Modul", createTitle: "{type} erstellen", editTitle: "{type} bearbeiten", requiredHint: "Intent-/Modulname, Anzeigename und Intent-Schlüssel sind Pflichtfelder.", category: "Kategorie", nameLabel: "{type}-Name", namePlaceholder: "{type}-Namen eingeben.", nameGuide: "Buchstaben, Zahlen, Leerzeichen und Sonderzeichen /-.() verwenden", displayName: "Anzeigename", displayNamePlaceholder: "Anzeigenamen eingeben.", dialogKey: "Intent-Schlüssel", dialogKeyDescription: "Stabiler Schlüssel zur internen Identifikation des Intents/Moduls und zur Referenzierung durch Engines oder externe Integrationen.", dialogKeyGuide: "Buchstaben, Zahlen, Sonderzeichen und Unterstrich (_) verwenden", transitionLocked: "Intent-Wechsel sperren", transitionLockedDescription: "Verhindert während des Szenarios den Wechsel zu anderen Intents, damit die entworfene Unterhaltung abgeschlossen wird.", returnBlocked: "Intent-Rückkehr blockieren", returnBlockedDescription: "Verhindert nach dem Eintritt in einen anderen Intent die Rückkehr zum aktuellen Intent.", feedbackEnabled: "Feedback je Intent", feedbackEnabledDescription: "Ermöglicht die Bewertung nach Abschluss des Intent-Szenarios. Nachrichten und Skala folgen den Bot-Einstellungen.", feedbackLocked: "Der Feedbackmodus ist in den Bot-Einstellungen auf {mode} gesetzt und kann hier nicht geändert werden.", feedbackModeNone: "`Deaktiviert`", feedbackModeAll: "`Alle Intents`", llmPrompt: "LLM-Antwortprompt", llmPromptDescription: "Vorrangige Anweisung für LLM- oder LLM-RAG-Antworten dieses Intents. Leer lassen, um den Bot-Standardprompt zu verwenden.", llmPromptPlaceholder: "Ton, Format und Einschränkungen für LLM-Antworten dieses Intents eingeben.", llmPromptFallback: "Leer lassen, um den Standard-LLM-Antwortprompt des Bots zu verwenden.", tags: "Tags", tagsDescription: "Werte zum Gruppieren und Verwalten ähnlicher Intents. Neuen Tag eingeben und mit Enter hinzufügen.", tagsPlaceholder: "Tag eingeben und Enter drücken.", tagsGuide: "Nur Buchstaben, Zahlen und Leerzeichen; bis zu 10 Tags", close: "Schließen", cancel: "Abbrechen", saving: "Speichern...", confirm: "Bestätigen", created: "{type} wurde erstellt.", updated: "Grundinformationen von {type} wurden aktualisiert.",
    validation: { maxTags: "Sie können bis zu 10 Tags registrieren.", noActiveVersion: "Keine aktive Version vorhanden.", nameRequired: "Intent-/Modulname eingeben.", duplicateName: "Dieser Intent-/Modulname wird bereits verwendet.", duplicateKey: "Dieser Intent-Schlüssel wird bereits verwendet.", saveFailed: "Intent/Modul konnte nicht gespeichert werden." },
  },
} satisfies Record<SupportedLanguage, IntentEditorCatalog>;

export function formatIntentEditorText(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}