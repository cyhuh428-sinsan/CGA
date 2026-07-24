import type { SupportedLanguage } from "@/lib/language";

export type SimulatorCatalog = {
  botTestBreadcrumb: string; botTestTitle: string; loading: string; loadFailed: string; inputPlaceholder: string;
  send: string; analysisData: string; closeAnalysis: string; emptyAnalysis: string; openSimulator: string;
  closeSimulator: string; dialogLabel: string; runtimeTab: string; defaultGreeting: string;
  intentFallback: string; multiIntentGuide: string; runtimeFlowError: string; systemError: string;
};

const enUiLabels: Record<string, string> = {
  "봇":"Bot","HTML 메시지":"HTML message","표시할 항목이 없습니다.":"No items to display.","DTMF 입력":"DTMF input",
  "입력 대기 중":"Waiting for input","지우기":"Delete","입력 완료":"Submit input","대화 재시작":"Restart conversation",
  "플로팅 버튼 닫기":"Close floating buttons","대화 불러오기":"Load conversation","대화 저장하기":"Save conversation","대화 전체보기":"View full conversation",
  "사용자 발화":"User utterance","선택 의도":"Selected intent","상세 진단 데이터":"Detailed diagnostic data","의도분류 Score-in":"Intent classification Score-in",
  "의도분류 Score-out":"Intent classification Score-out","변수 스냅샷":"Variable snapshots","변수 스냅샷 없음":"No variable snapshots",
  "불러온 대화 전체보기":"View loaded conversation","확인":"Confirm","대상 없음":"No targets","전체 변수 스냅샷":"All variable snapshots",
  "전체 처리 로그":"All processing logs","처리 로그 없음":"No processing logs","현재 런타임 상태":"Current runtime state","대화":"Conversation",
  "다음 카드":"Next card","대기 카드":"Waiting card","종료 여부":"End status","세션 종료":"Session ended","대화 종료":"Conversation ended","진행 중":"In progress",
  "변수값 없음":"No variable values","(빈 값)":"(empty)","개체 인식":"Entity recognition","인식된 개체 없음":"No recognized entities","미인식":"Not recognized",
  "오류 / 이상 상황":"Errors / anomalies","오류 없음":"No errors","시나리오 흐름":"Scenario flow","카드 실행 후 변수값":"Variable values after card execution",
  "표시할 카드 흐름 없음":"No card flow to display","의도 인식 적용 단계":"Applied intent recognition stage","적용 대상":"Applied target",
  "의도":"Intent","스코어/확률":"Score/Probability","검증 문장 진단":"Validation utterance diagnostics","등록된 Validation 문장이 없습니다.":"No validation utterances are registered.",
  "Score Setting":"Score Setting","대화시작 카드":"Conversation start card","연결된 의도":"Connected intent","분류 결과":"Classification result",
  "Semantic 검색 근거":"Semantic search evidence","LLM 분류 근거":"LLM classification evidence","형태소":"Morphemes","근거":"Evidence","분류 토큰":"Classification tokens",
  "판정 순서: 제외/무시 → 스몰토크 → Exacting Matching → 룰 → ML/시멘틱/LLM. 앞 단계가 적용되면 이후 단계는 실행하지 않습니다.":"Decision order: Exclude/Ignore → Small Talk → Exact Matching → Rule → ML/Semantic/LLM. Once a stage applies, later stages are not run.",
  "불러올 사용자 문장이 없습니다.":"There are no user utterances to load.","JSON 대화 파일을 읽지 못했습니다.":"Could not read the JSON conversation file.",
  "이미지":"Image","이미지 열기":"Open image","이전으로":"Back","항목":"Item","카카오맵":"Kakao Map","지도":"Map","스카이뷰":"Sky View","위치":"Location","선택":"Select","선택하세요":"Select","팝업 열기":"Open popup","닫기":"Close","팝업타이틀":"Popup title","팝업":"Popup","팝업에 표시할 데이터가 없습니다.":"No data to display in the popup."
};

const richFormNativeLabels: Partial<Record<SupportedLanguage, Record<string, string>>> = {
  "zh-CN": { "이미지":"图片","이미지 열기":"打开图片","이전으로":"返回","항목":"项目","카카오맵":"Kakao 地图","지도":"地图","스카이뷰":"天空视图","위치":"位置","선택":"选择","선택하세요":"请选择","팝업 열기":"打开弹窗","닫기":"关闭","팝업타이틀":"弹窗标题","팝업":"弹窗","팝업에 표시할 데이터가 없습니다.":"弹窗中没有可显示的数据。" },
  ja: { "이미지":"画像","이미지 열기":"画像を開く","이전으로":"戻る","항목":"項目","카카오맵":"Kakaoマップ","지도":"地図","스카이뷰":"スカイビュー","위치":"場所","선택":"選択","선택하세요":"選択してください","팝업 열기":"ポップアップを開く","닫기":"閉じる","팝업타이틀":"ポップアップタイトル","팝업":"ポップアップ","팝업에 표시할 데이터가 없습니다.":"ポップアップに表示するデータがありません。" },
  vi: { "이미지":"Hình ảnh","이미지 열기":"Mở hình ảnh","이전으로":"Quay lại","항목":"Mục","카카오맵":"Bản đồ Kakao","지도":"Bản đồ","스카이뷰":"Chế độ xem bầu trời","위치":"Vị trí","선택":"Chọn","선택하세요":"Vui lòng chọn","팝업 열기":"Mở cửa sổ bật lên","닫기":"Đóng","팝업타이틀":"Tiêu đề cửa sổ bật lên","팝업":"Cửa sổ bật lên","팝업에 표시할 데이터가 없습니다.":"Không có dữ liệu để hiển thị trong cửa sổ bật lên." },
  fr: { "이미지":"Image","이미지 열기":"Ouvrir l’image","이전으로":"Retour","항목":"Élément","카카오맵":"Carte Kakao","지도":"Carte","스카이뷰":"Vue du ciel","위치":"Emplacement","선택":"Sélectionner","선택하세요":"Sélectionnez","팝업 열기":"Ouvrir la fenêtre","닫기":"Fermer","팝업타이틀":"Titre de la fenêtre","팝업":"Fenêtre","팝업에 표시할 데이터가 없습니다.":"Aucune donnée à afficher dans la fenêtre." },
  de: { "이미지":"Bild","이미지 열기":"Bild öffnen","이전으로":"Zurück","항목":"Element","카카오맵":"Kakao-Karte","지도":"Karte","스카이뷰":"Himmelsansicht","위치":"Standort","선택":"Auswählen","선택하세요":"Bitte auswählen","팝업 열기":"Popup öffnen","닫기":"Schließen","팝업타이틀":"Popup-Titel","팝업":"Popup","팝업에 표시할 데이터가 없습니다.":"Keine Daten im Popup verfügbar." },
};

const simulatorUiLabels: Record<SupportedLanguage, Record<string, string>> = {
  ko: {}, en: enUiLabels,
  "zh-CN": { ...enUiLabels, ...richFormNativeLabels["zh-CN"], "봇":"机器人","대화 재시작":"重新开始对话","대화 불러오기":"加载对话","대화 저장하기":"保存对话","대화 전체보기":"查看完整对话","사용자 발화":"用户话语","선택 의도":"所选意图","상세 진단 데이터":"详细诊断数据","변수 스냅샷":"变量快照","확인":"确认","현재 런타임 상태":"当前运行状态","개체 인식":"实体识别","오류 / 이상 상황":"错误 / 异常","시나리오 흐름":"场景流程" },
  ja: { ...enUiLabels, ...richFormNativeLabels.ja, "봇":"ボット","대화 재시작":"会話を再開","대화 불러오기":"会話を読み込む","대화 저장하기":"会話を保存","대화 전체보기":"会話全体を表示","사용자 발화":"ユーザー発話","선택 의도":"選択インテント","상세 진단 데이터":"詳細診断データ","변수 스냅샷":"変数スナップショット","확인":"確認","현재 런타임 상태":"現在のランタイム状態","개체 인식":"エンティティ認識","오류 / 이상 상황":"エラー / 異常","시나리오 흐름":"シナリオフロー" },
  vi: { ...enUiLabels, ...richFormNativeLabels.vi, "봇":"Bot","대화 재시작":"Khởi động lại hội thoại","대화 불러오기":"Tải hội thoại","대화 저장하기":"Lưu hội thoại","대화 전체보기":"Xem toàn bộ hội thoại","사용자 발화":"Phát ngôn người dùng","선택 의도":"Ý định đã chọn","상세 진단 데이터":"Dữ liệu chẩn đoán chi tiết","변수 스냅샷":"Ảnh chụp biến","확인":"Xác nhận","현재 런타임 상태":"Trạng thái chạy hiện tại","개체 인식":"Nhận dạng thực thể","오류 / 이상 상황":"Lỗi / bất thường","시나리오 흐름":"Luồng kịch bản" },
  fr: { ...enUiLabels, ...richFormNativeLabels.fr, "봇":"Bot","대화 재시작":"Redémarrer la conversation","대화 불러오기":"Charger la conversation","대화 저장하기":"Enregistrer la conversation","대화 전체보기":"Voir toute la conversation","사용자 발화":"Énoncé utilisateur","선택 의도":"Intention sélectionnée","상세 진단 데이터":"Données de diagnostic détaillées","변수 스냅샷":"Instantanés des variables","확인":"Confirmer","현재 런타임 상태":"État d’exécution actuel","개체 인식":"Reconnaissance d’entités","오류 / 이상 상황":"Erreurs / anomalies","시나리오 흐름":"Flux du scénario" },
  de: { ...enUiLabels, ...richFormNativeLabels.de, "봇":"Bot","대화 재시작":"Gespräch neu starten","대화 불러오기":"Gespräch laden","대화 저장하기":"Gespräch speichern","대화 전체보기":"Gesamtes Gespräch anzeigen","사용자 발화":"Benutzeräußerung","선택 의도":"Ausgewählter Intent","상세 진단 데이터":"Detaillierte Diagnosedaten","변수 스냅샷":"Variablen-Snapshots","확인":"Bestätigen","현재 런타임 상태":"Aktueller Laufzeitstatus","개체 인식":"Entitätserkennung","오류 / 이상 상황":"Fehler / Auffälligkeiten","시나리오 흐름":"Szenarioablauf" },
};

export function getSimulatorLabel(language: SupportedLanguage, value: string): string {
  return simulatorUiLabels[language][value] ?? (language === "ko" ? value : enUiLabels[value] ?? value);
}
export const SIMULATOR_CATALOGS = {
  ko: {
    botTestBreadcrumb: "봇 테스트 사용하기 > 봇과 대화하기", botTestTitle: "봇 테스트",
    loading: "봇 테스트 정보를 불러오는 중입니다.", loadFailed: "봇 정보를 불러오지 못했습니다.",
    inputPlaceholder: "챗봇과 대화를 진행해보세요.", send: "전송", analysisData: "분석 데이터",
    closeAnalysis: "분석 데이터 닫기", emptyAnalysis: "대화를 진행하면 분석 데이터가 표시됩니다.",
    openSimulator: "봇 테스트 열기", closeSimulator: "봇 테스트 닫기", dialogLabel: "봇 테스트",
    runtimeTab: "Runtime / Variables / Trace", defaultGreeting: "{bot} 대화 시뮬레이터입니다. 저장된 대화 기준으로 테스트할 문장을 입력하세요.",
    intentFallback: "질문을 이해하지 못했습니다. 다시 말씀해주세요.", multiIntentGuide: "아래 후보 중 원하는 의도를 선택해주세요.",
    runtimeFlowError: "대화 흐름 설정 오류로 대화를 계속할 수 없습니다.", systemError: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  },
  en: {
    botTestBreadcrumb: "Use Bot Test > Talk to the Bot", botTestTitle: "Bot Test",
    loading: "Loading bot test information.", loadFailed: "Failed to load bot information.",
    inputPlaceholder: "Start a conversation with the bot.", send: "Send", analysisData: "Analysis Data",
    closeAnalysis: "Close analysis data", emptyAnalysis: "Analysis data appears after you start a conversation.",
    openSimulator: "Open Bot Test", closeSimulator: "Close Bot Test", dialogLabel: "Bot Test",
    runtimeTab: "Runtime / Variables / Trace", defaultGreeting: "This is the {bot} conversation simulator. Enter a sentence to test the saved conversation.",
    intentFallback: "I could not understand your question. Please try again.", multiIntentGuide: "Please select the intent you want below.",
    runtimeFlowError: "The conversation cannot continue because of a flow configuration error.", systemError: "An error occurred while processing. Please try again later.",
  },
  "zh-CN": {
    botTestBreadcrumb: "使用机器人测试 > 与机器人对话", botTestTitle: "机器人测试",
    loading: "正在加载机器人测试信息。", loadFailed: "无法加载机器人信息。",
    inputPlaceholder: "开始与机器人对话。", send: "发送", analysisData: "分析数据",
    closeAnalysis: "关闭分析数据", emptyAnalysis: "开始对话后将显示分析数据。",
    openSimulator: "打开机器人测试", closeSimulator: "关闭机器人测试", dialogLabel: "机器人测试",
    runtimeTab: "运行时 / 变量 / 跟踪", defaultGreeting: "这是 {bot} 对话模拟器。请输入要基于已保存对话测试的句子。",
    intentFallback: "未能理解您的问题，请重新说明。", multiIntentGuide: "请从以下候选中选择您需要的意图。",
    runtimeFlowError: "由于对话流程配置错误，无法继续对话。", systemError: "处理过程中发生错误，请稍后重试。",
  },
  ja: {
    botTestBreadcrumb: "ボットテストを使う > ボットと会話する", botTestTitle: "ボットテスト",
    loading: "ボットテスト情報を読み込み中です。", loadFailed: "ボット情報を読み込めませんでした。",
    inputPlaceholder: "ボットとの会話を始めてください。", send: "送信", analysisData: "分析データ",
    closeAnalysis: "分析データを閉じる", emptyAnalysis: "会話を開始すると分析データが表示されます。",
    openSimulator: "ボットテストを開く", closeSimulator: "ボットテストを閉じる", dialogLabel: "ボットテスト",
    runtimeTab: "ランタイム / 変数 / トレース", defaultGreeting: "{bot} 会話シミュレーターです。保存済み会話をテストする文を入力してください。",
    intentFallback: "質問を理解できませんでした。もう一度お話しください。", multiIntentGuide: "以下の候補から希望するインテントを選択してください。",
    runtimeFlowError: "会話フローの設定エラーにより会話を続行できません。", systemError: "処理中にエラーが発生しました。しばらくしてから再試行してください。",
  },
  vi: {
    botTestBreadcrumb: "Sử dụng kiểm thử bot > Trò chuyện với bot", botTestTitle: "Kiểm thử bot",
    loading: "Đang tải thông tin kiểm thử bot.", loadFailed: "Không thể tải thông tin bot.",
    inputPlaceholder: "Bắt đầu trò chuyện với bot.", send: "Gửi", analysisData: "Dữ liệu phân tích",
    closeAnalysis: "Đóng dữ liệu phân tích", emptyAnalysis: "Dữ liệu phân tích sẽ xuất hiện sau khi bắt đầu hội thoại.",
    openSimulator: "Mở kiểm thử bot", closeSimulator: "Đóng kiểm thử bot", dialogLabel: "Kiểm thử bot",
    runtimeTab: "Thời gian chạy / Biến / Truy vết", defaultGreeting: "Đây là trình mô phỏng hội thoại {bot}. Nhập câu để kiểm thử hội thoại đã lưu.",
    intentFallback: "Tôi chưa hiểu câu hỏi. Vui lòng nói lại.", multiIntentGuide: "Vui lòng chọn ý định mong muốn bên dưới.",
    runtimeFlowError: "Không thể tiếp tục do lỗi cấu hình luồng hội thoại.", systemError: "Đã xảy ra lỗi khi xử lý. Vui lòng thử lại sau.",
  },
  fr: {
    botTestBreadcrumb: "Utiliser le test du bot > Parler au bot", botTestTitle: "Test du bot",
    loading: "Chargement des informations du test.", loadFailed: "Impossible de charger les informations du bot.",
    inputPlaceholder: "Commencez une conversation avec le bot.", send: "Envoyer", analysisData: "Données d’analyse",
    closeAnalysis: "Fermer les données d’analyse", emptyAnalysis: "Les données d’analyse apparaîtront après le début de la conversation.",
    openSimulator: "Ouvrir le test du bot", closeSimulator: "Fermer le test du bot", dialogLabel: "Test du bot",
    runtimeTab: "Exécution / Variables / Trace", defaultGreeting: "Voici le simulateur de conversation {bot}. Saisissez une phrase pour tester la conversation enregistrée.",
    intentFallback: "Je n’ai pas compris votre question. Veuillez reformuler.", multiIntentGuide: "Veuillez sélectionner l’intention souhaitée ci-dessous.",
    runtimeFlowError: "La conversation ne peut pas continuer en raison d’une erreur de configuration du flux.", systemError: "Une erreur s’est produite pendant le traitement. Veuillez réessayer plus tard.",
  },
  de: {
    botTestBreadcrumb: "Bot-Test verwenden > Mit dem Bot sprechen", botTestTitle: "Bot-Test",
    loading: "Bot-Testinformationen werden geladen.", loadFailed: "Bot-Informationen konnten nicht geladen werden.",
    inputPlaceholder: "Starten Sie ein Gespräch mit dem Bot.", send: "Senden", analysisData: "Analysedaten",
    closeAnalysis: "Analysedaten schließen", emptyAnalysis: "Analysedaten werden nach Beginn des Gesprächs angezeigt.",
    openSimulator: "Bot-Test öffnen", closeSimulator: "Bot-Test schließen", dialogLabel: "Bot-Test",
    runtimeTab: "Laufzeit / Variablen / Trace", defaultGreeting: "Dies ist der Gesprächssimulator für {bot}. Geben Sie einen Testsatz für das gespeicherte Gespräch ein.",
    intentFallback: "Ich konnte Ihre Frage nicht verstehen. Bitte formulieren Sie sie neu.", multiIntentGuide: "Bitte wählen Sie unten den gewünschten Intent aus.",
    runtimeFlowError: "Das Gespräch kann wegen eines Konfigurationsfehlers nicht fortgesetzt werden.", systemError: "Bei der Verarbeitung ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
  },
} satisfies Record<SupportedLanguage, SimulatorCatalog>;

export const SIMULATOR_DTMF_CATALOGS = {
  ko: { guide: "{min}~{max}자리 입력 후 {end}을 누르세요. 최초 {first}초, 전체 {overall}초", lengthError: "{min}~{max}자리로 입력하세요." },
  en: { guide: "Enter {min} to {max} digits, then press {end}. First input: {first}s, total: {overall}s", lengthError: "Enter {min} to {max} digits." },
  "zh-CN": { guide: "输入 {min}~{max} 位后按 {end}。首次 {first} 秒，总计 {overall} 秒", lengthError: "请输入 {min}~{max} 位。" },
  ja: { guide: "{min}〜{max}桁を入力してから {end} を押してください。初回 {first}秒、全体 {overall}秒", lengthError: "{min}〜{max}桁で入力してください。" },
  vi: { guide: "Nhập {min}~{max} chữ số rồi nhấn {end}. Lần đầu {first} giây, tổng {overall} giây", lengthError: "Hãy nhập {min}~{max} chữ số." },
  fr: { guide: "Saisissez {min} à {max} chiffres, puis appuyez sur {end}. Première saisie : {first}s, total : {overall}s", lengthError: "Saisissez {min} à {max} chiffres." },
  de: { guide: "Geben Sie {min} bis {max} Ziffern ein und drücken Sie dann {end}. Erste Eingabe: {first}s, gesamt: {overall}s", lengthError: "Geben Sie {min} bis {max} Ziffern ein." },
} satisfies Record<SupportedLanguage, { guide: string; lengthError: string }>;
export function formatSimulatorText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
