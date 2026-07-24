from __future__ import annotations

from typing import TypedDict


class DefaultMessageDefinition(TypedDict):
    message_name: str
    message_text: str
    description: str


def _message(name: str, text: str, description: str) -> DefaultMessageDefinition:
    return {"message_name": name, "message_text": text, "description": description}


DEFAULT_MESSAGE_CATALOGS: dict[str, dict[str, DefaultMessageDefinition]] = {
    "ko": {
        "intent_fallback": _message("의도 미분류 메시지", "질문을 이해하지 못했습니다. 다시 말씀해주세요.", "사용자 발화에서 의도를 찾지 못했을 때 출력합니다."),
        "multi_intent_guide": _message("다중 의도 선택 안내", "아래 후보 중 원하는 의도를 선택해주세요.", "여러 의도가 후보로 잡혔을 때 출력합니다."),
        "no_desired_intent": _message("원하는 의도 없음 메시지", "원하는 의도가 없습니다. 다시 말씀해주세요.", "원하는 후보 의도가 없을 때 출력합니다."),
        "intent_receipt": _message("의도 접수 메시지", "{{intentName}} 의도로 접수되었습니다.", "연결된 흐름 없이 의도만 인식되었을 때 출력합니다."),
        "invalid_button": _message("버튼 오류 메시지", "선택할 수 없는 항목입니다. 다시 선택해주세요.", "유효하지 않은 버튼이나 선택지가 입력되었을 때 출력합니다."),
        "generic_select": _message("기본 선택 안내", "선택하세요.", "버튼형 메시지에 안내 문구가 없을 때 출력합니다."),
        "table_select": _message("테이블 선택 안내", "아래 중 선택하세요.", "테이블형 메시지에 안내 문구가 없을 때 출력합니다."),
        "system_error": _message("시스템 오류 메시지", "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "API 또는 시스템 오류가 발생했을 때 출력합니다."),
        "runtime_flow_error": _message("대화 흐름 설정 오류 메시지", "대화 흐름 설정 오류로 대화를 계속할 수 없습니다.", "대화 흐름 설정 오류가 발생했을 때 출력합니다."),
        "runtime_module_not_found": _message("대화 모듈 연결 오류 메시지", "연결할 대화 모듈을 찾지 못했습니다.", "연결할 대화 모듈을 찾지 못했을 때 출력합니다."),
        "runtime_flow_limit": _message("대화 흐름 실행 한도 초과 메시지", "대화 흐름 실행 한도를 초과했습니다.", "대화 흐름 실행 한도를 초과했을 때 출력합니다."),
        "timeout": _message("타임아웃 메시지", "응답 시간이 초과되었습니다. 처음부터 다시 진행해주세요.", "대화 타임아웃 발생 시 출력합니다."),
        "session_end": _message("세션 종료 메시지", "대화가 종료되었습니다.", "세션 종료 시 출력합니다."),
        "conversation_in_progress": _message("진행 중 대화 안내", "진행 중인 대화가 있습니다. 현재 대화를 먼저 완료해주세요.", "이미 진행 중인 대화가 있을 때 출력합니다."),
    },
    "en": {
        "intent_fallback": _message("Unclassified intent", "I could not understand your question. Please try again.", "Shown when no intent is found."),
        "multi_intent_guide": _message("Multiple intent guide", "Please select the intent you want from the options below.", "Shown when multiple intents are candidates."),
        "no_desired_intent": _message("No desired intent", "The intent you want is not listed. Please try again.", "Shown when no candidate is desired."),
        "intent_receipt": _message("Intent receipt", "Your request was received as the {{intentName}} intent.", "Shown when only an intent is recognized."),
        "invalid_button": _message("Invalid button", "This option cannot be selected. Please choose again.", "Shown for an invalid button or option."),
        "generic_select": _message("Selection guide", "Please select an option.", "Used when a button message has no guide."),
        "table_select": _message("Table selection guide", "Please select one of the options below.", "Used when a table message has no guide."),
        "system_error": _message("System error", "An error occurred while processing. Please try again later.", "Shown for an API or system error."),
        "runtime_flow_error": _message("Conversation flow error", "The conversation cannot continue because of a flow configuration error.", "Shown for a flow configuration error."),
        "runtime_module_not_found": _message("Conversation module error", "The conversation module to connect could not be found.", "Shown when a linked module is missing."),
        "runtime_flow_limit": _message("Flow execution limit", "The conversation flow execution limit was exceeded.", "Shown when the runtime limit is exceeded."),
        "timeout": _message("Timeout", "The response timed out. Please start again.", "Shown when the conversation times out."),
        "session_end": _message("Session ended", "The conversation has ended.", "Shown when the session ends."),
        "conversation_in_progress": _message("Conversation in progress", "A conversation is already in progress. Please complete it first.", "Shown when a conversation is already active."),
    },
    "zh-CN": {
        "intent_fallback": _message("意图未分类消息", "未能理解您的问题，请重新说明。", "未找到用户话语意图时显示。"),
        "multi_intent_guide": _message("多意图选择提示", "请从以下候选中选择您需要的意图。", "存在多个候选意图时显示。"),
        "no_desired_intent": _message("无所需意图消息", "没有您需要的意图，请重新说明。", "候选中没有所需意图时显示。"),
        "intent_receipt": _message("意图接收消息", "已按 {{intentName}} 意图受理。", "仅识别到意图时显示。"),
        "invalid_button": _message("按钮错误消息", "无法选择该项目，请重新选择。", "输入无效按钮或选项时显示。"),
        "generic_select": _message("默认选择提示", "请选择。", "按钮消息没有提示时使用。"),
        "table_select": _message("表格选择提示", "请从以下选项中选择。", "表格消息没有提示时使用。"),
        "system_error": _message("系统错误消息", "处理过程中发生错误，请稍后重试。", "发生 API 或系统错误时显示。"),
        "runtime_flow_error": _message("对话流程错误消息", "由于对话流程配置错误，无法继续对话。", "发生流程配置错误时显示。"),
        "runtime_module_not_found": _message("对话模块连接错误", "未找到要连接的对话模块。", "未找到连接模块时显示。"),
        "runtime_flow_limit": _message("流程执行限制消息", "已超过对话流程执行限制。", "超过运行限制时显示。"),
        "timeout": _message("超时消息", "响应超时，请从头开始。", "对话超时时显示。"),
        "session_end": _message("会话结束消息", "对话已结束。", "会话结束时显示。"),
        "conversation_in_progress": _message("对话进行中提示", "已有正在进行的对话，请先完成当前对话。", "已有活动对话时显示。"),
    },
    "ja": {
        "intent_fallback": _message("インテント未分類メッセージ", "質問を理解できませんでした。もう一度お話しください。", "インテントが見つからない場合に表示します。"),
        "multi_intent_guide": _message("複数インテント選択案内", "以下の候補から希望するインテントを選択してください。", "候補が複数ある場合に表示します。"),
        "no_desired_intent": _message("希望インテントなし", "希望するインテントがありません。もう一度お話しください。", "希望する候補がない場合に表示します。"),
        "intent_receipt": _message("インテント受付メッセージ", "{{intentName}} インテントとして受け付けました。", "インテントのみ認識された場合に表示します。"),
        "invalid_button": _message("ボタンエラーメッセージ", "選択できない項目です。もう一度選択してください。", "無効な選択時に表示します。"),
        "generic_select": _message("基本選択案内", "選択してください。", "ボタン案内がない場合に使用します。"),
        "table_select": _message("テーブル選択案内", "以下から選択してください。", "テーブル案内がない場合に使用します。"),
        "system_error": _message("システムエラーメッセージ", "処理中にエラーが発生しました。しばらくしてから再試行してください。", "API またはシステムエラー時に表示します。"),
        "runtime_flow_error": _message("会話フロー設定エラー", "会話フローの設定エラーにより会話を続行できません。", "フロー設定エラー時に表示します。"),
        "runtime_module_not_found": _message("会話モジュール接続エラー", "接続する会話モジュールが見つかりませんでした。", "接続先モジュールがない場合に表示します。"),
        "runtime_flow_limit": _message("フロー実行上限メッセージ", "会話フローの実行上限を超えました。", "実行上限超過時に表示します。"),
        "timeout": _message("タイムアウトメッセージ", "応答時間を超過しました。最初からやり直してください。", "会話タイムアウト時に表示します。"),
        "session_end": _message("セッション終了メッセージ", "会話が終了しました。", "セッション終了時に表示します。"),
        "conversation_in_progress": _message("会話進行中案内", "進行中の会話があります。現在の会話を先に完了してください。", "会話が既に進行中の場合に表示します。"),
    },
    "vi": {
        "intent_fallback": _message("Ý định chưa phân loại", "Tôi chưa hiểu câu hỏi. Vui lòng nói lại.", "Hiển thị khi không tìm thấy ý định."),
        "multi_intent_guide": _message("Hướng dẫn nhiều ý định", "Vui lòng chọn ý định mong muốn bên dưới.", "Hiển thị khi có nhiều ý định ứng viên."),
        "no_desired_intent": _message("Không có ý định phù hợp", "Không có ý định bạn muốn. Vui lòng nói lại.", "Hiển thị khi không có ứng viên phù hợp."),
        "intent_receipt": _message("Xác nhận ý định", "Yêu cầu đã được tiếp nhận theo ý định {{intentName}}.", "Hiển thị khi chỉ nhận diện được ý định."),
        "invalid_button": _message("Lỗi nút", "Không thể chọn mục này. Vui lòng chọn lại.", "Hiển thị cho lựa chọn không hợp lệ."),
        "generic_select": _message("Hướng dẫn chọn", "Vui lòng chọn.", "Dùng khi tin nhắn nút không có hướng dẫn."),
        "table_select": _message("Hướng dẫn chọn bảng", "Vui lòng chọn một mục bên dưới.", "Dùng khi tin nhắn bảng không có hướng dẫn."),
        "system_error": _message("Lỗi hệ thống", "Đã xảy ra lỗi khi xử lý. Vui lòng thử lại sau.", "Hiển thị khi có lỗi API hoặc hệ thống."),
        "runtime_flow_error": _message("Lỗi luồng hội thoại", "Không thể tiếp tục do lỗi cấu hình luồng hội thoại.", "Hiển thị khi cấu hình luồng bị lỗi."),
        "runtime_module_not_found": _message("Lỗi mô-đun hội thoại", "Không tìm thấy mô-đun hội thoại cần kết nối.", "Hiển thị khi thiếu mô-đun liên kết."),
        "runtime_flow_limit": _message("Giới hạn thực thi luồng", "Đã vượt quá giới hạn thực thi luồng hội thoại.", "Hiển thị khi vượt giới hạn chạy."),
        "timeout": _message("Hết thời gian", "Đã hết thời gian phản hồi. Vui lòng bắt đầu lại.", "Hiển thị khi hội thoại hết thời gian."),
        "session_end": _message("Kết thúc phiên", "Cuộc hội thoại đã kết thúc.", "Hiển thị khi phiên kết thúc."),
        "conversation_in_progress": _message("Hội thoại đang diễn ra", "Đang có một cuộc hội thoại. Vui lòng hoàn tất trước.", "Hiển thị khi đã có hội thoại đang hoạt động."),
    },
    "fr": {
        "intent_fallback": _message("Intention non classée", "Je n’ai pas compris votre question. Veuillez reformuler.", "Affiché quand aucune intention n’est trouvée."),
        "multi_intent_guide": _message("Guide de sélection d’intention", "Veuillez sélectionner l’intention souhaitée ci-dessous.", "Affiché lorsque plusieurs intentions sont candidates."),
        "no_desired_intent": _message("Aucune intention souhaitée", "L’intention souhaitée n’est pas proposée. Veuillez reformuler.", "Affiché lorsqu’aucun candidat ne convient."),
        "intent_receipt": _message("Réception de l’intention", "Votre demande a été reçue comme intention {{intentName}}.", "Affiché lorsque seule l’intention est reconnue."),
        "invalid_button": _message("Bouton non valide", "Cette option ne peut pas être sélectionnée. Veuillez recommencer.", "Affiché pour une sélection non valide."),
        "generic_select": _message("Guide de sélection", "Veuillez sélectionner une option.", "Utilisé si un message bouton n’a pas d’instruction."),
        "table_select": _message("Guide de sélection de tableau", "Veuillez sélectionner une option ci-dessous.", "Utilisé si un tableau n’a pas d’instruction."),
        "system_error": _message("Erreur système", "Une erreur s’est produite pendant le traitement. Veuillez réessayer plus tard.", "Affiché pour une erreur API ou système."),
        "runtime_flow_error": _message("Erreur de flux de conversation", "La conversation ne peut pas continuer en raison d’une erreur de configuration du flux.", "Affiché pour une erreur de configuration."),
        "runtime_module_not_found": _message("Erreur de module de conversation", "Le module de conversation à connecter est introuvable.", "Affiché si un module lié manque."),
        "runtime_flow_limit": _message("Limite d’exécution du flux", "La limite d’exécution du flux de conversation a été dépassée.", "Affiché lorsque la limite est dépassée."),
        "timeout": _message("Délai dépassé", "Le délai de réponse est dépassé. Veuillez recommencer.", "Affiché lorsque la conversation expire."),
        "session_end": _message("Session terminée", "La conversation est terminée.", "Affiché à la fin de la session."),
        "conversation_in_progress": _message("Conversation en cours", "Une conversation est déjà en cours. Veuillez d’abord la terminer.", "Affiché lorsqu’une conversation est active."),
    },
    "de": {
        "intent_fallback": _message("Nicht klassifizierter Intent", "Ich konnte Ihre Frage nicht verstehen. Bitte formulieren Sie sie neu.", "Wird angezeigt, wenn kein Intent gefunden wird."),
        "multi_intent_guide": _message("Auswahl mehrerer Intents", "Bitte wählen Sie unten den gewünschten Intent aus.", "Wird bei mehreren Kandidaten angezeigt."),
        "no_desired_intent": _message("Kein gewünschter Intent", "Der gewünschte Intent ist nicht vorhanden. Bitte versuchen Sie es erneut.", "Wird angezeigt, wenn kein Kandidat passt."),
        "intent_receipt": _message("Intent-Bestätigung", "Ihre Anfrage wurde als Intent {{intentName}} aufgenommen.", "Wird angezeigt, wenn nur der Intent erkannt wurde."),
        "invalid_button": _message("Ungültige Schaltfläche", "Diese Option kann nicht ausgewählt werden. Bitte wählen Sie erneut.", "Wird bei einer ungültigen Auswahl angezeigt."),
        "generic_select": _message("Auswahlhinweis", "Bitte wählen Sie eine Option.", "Wird ohne Hinweis für Schaltflächen verwendet."),
        "table_select": _message("Tabellenauswahl", "Bitte wählen Sie unten eine Option.", "Wird ohne Hinweis für Tabellen verwendet."),
        "system_error": _message("Systemfehler", "Bei der Verarbeitung ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.", "Wird bei API- oder Systemfehlern angezeigt."),
        "runtime_flow_error": _message("Gesprächsablauffehler", "Das Gespräch kann wegen eines Konfigurationsfehlers nicht fortgesetzt werden.", "Wird bei einem Ablauffehler angezeigt."),
        "runtime_module_not_found": _message("Gesprächsmodulfehler", "Das zu verbindende Gesprächsmodul wurde nicht gefunden.", "Wird bei einem fehlenden Modul angezeigt."),
        "runtime_flow_limit": _message("Ausführungslimit", "Das Ausführungslimit des Gesprächsablaufs wurde überschritten.", "Wird beim Überschreiten des Limits angezeigt."),
        "timeout": _message("Zeitüberschreitung", "Die Antwortzeit wurde überschritten. Bitte beginnen Sie erneut.", "Wird bei einem Timeout angezeigt."),
        "session_end": _message("Sitzung beendet", "Das Gespräch wurde beendet.", "Wird am Ende der Sitzung angezeigt."),
        "conversation_in_progress": _message("Gespräch läuft", "Ein Gespräch läuft bereits. Bitte schließen Sie es zuerst ab.", "Wird bei einem aktiven Gespräch angezeigt."),
    },
}


def default_message_text(language: str, message_key: str) -> str:
    localized = DEFAULT_MESSAGE_CATALOGS.get(language, DEFAULT_MESSAGE_CATALOGS["ko"])
    definition = localized.get(message_key) or DEFAULT_MESSAGE_CATALOGS["ko"].get(message_key)
    return definition["message_text"] if definition else ""
