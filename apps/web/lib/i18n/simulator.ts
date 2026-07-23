import type { SupportedLanguage } from "@/lib/language";

export type SimulatorCatalog = {
  botTestBreadcrumb: string; botTestTitle: string; loading: string; loadFailed: string; inputPlaceholder: string;
  send: string; analysisData: string; closeAnalysis: string; emptyAnalysis: string; openSimulator: string;
  closeSimulator: string; dialogLabel: string; runtimeTab: string; defaultGreeting: string;
  intentFallback: string; multiIntentGuide: string; runtimeFlowError: string; systemError: string;
};

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

export function formatSimulatorText(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
