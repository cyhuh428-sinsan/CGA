import type { SupportedLanguage } from "@/lib/language";

export type BotWorkspaceCatalog = {
  loadBotsError: string;
  loadWorkspaceError: string;
  module: string;
  intent: string;
  workspaceSaved: string;
  title: string;
  description: string;
  save: string;
  groupSelection: string;
  defaultGroup: string;
  accessibleBots: string;
  currentWorkBot: string;
  recentWork: string;
  countUnit: string;
  none: string;
  currentTarget: string;
  currentTargetDescription: string;
  selectBot: string;
  group: string;
  bot: string;
  version: string;
  status: string;
  language: string;
  lastWork: string;
  openSettings: string;
  openConfiguration: string;
  openManagement: string;
  openBuild: string;
  recentBots: string;
  workTime: string;
  currentBot: string;
  noRecentBots: string;
  workItems: string;
  workItemsDescription: string;
  category: string;
  intentModuleName: string;
  noWorkItems: string;
  evaluationDiagnostics: string;
  misclassified: string;
  utterance: string;
  expectedIntent: string;
  predictedIntentScore: string;
  noMisclassified: string;
  lowScore: string;
  score: string;
  noLowScore: string;
  similarIntentCollisions: string;
  predictedIntent: string;
  cases: string;
  noCollisions: string;
};

export const BOT_WORKSPACE_CATALOGS = {
  ko: { loadBotsError: "봇 목록을 불러오지 못했습니다.", loadWorkspaceError: "작업공간 정보를 불러오지 못했습니다.", module: "모듈", intent: "의도", workspaceSaved: "현재 작업 봇을 저장했습니다.", title: "봇 작업공간", description: "이미 생성된 봇과 버전을 선택해 작업을 이어가는 공간입니다.", save: "저장", groupSelection: "그룹 선택", defaultGroup: "기본 그룹", accessibleBots: "그룹 내 접근 봇", currentWorkBot: "현재 작업 봇", recentWork: "최근 작업", countUnit: "개", none: "없음", currentTarget: "현재 작업 대상", currentTargetDescription: "선택된 봇 기준으로 작업합니다.", selectBot: "봇 선택", group: "그룹", bot: "봇", version: "버전", status: "상태", language: "언어", lastWork: "마지막 작업", openSettings: "봇 설정 열기", openConfiguration: "봇 구성 열기", openManagement: "봇 관리 열기", openBuild: "봇 제작 열기", recentBots: "최근 작업 봇", workTime: "작업시각", currentBot: "현재봇", noRecentBots: "최근 작업 목록 없음", workItems: "작업 항목", workItemsDescription: "현재 봇의 의도와 모듈을 확인합니다.", category: "구분", intentModuleName: "의도/모듈명", noWorkItems: "등록된 작업 항목이 없습니다.", evaluationDiagnostics: "평가 진단", misclassified: "오분류 문장", utterance: "문장", expectedIntent: "정답 의도", predictedIntentScore: "예측 의도 / Score", noMisclassified: "오분류 문장이 없습니다.", lowScore: "낮은 Score 문장", score: "Score", noLowScore: "낮은 Score 문장이 없습니다.", similarIntentCollisions: "유사 의도 충돌", predictedIntent: "예측 의도", cases: "건수", noCollisions: "충돌 없음" },
  en: { loadBotsError: "Could not load the bot list.", loadWorkspaceError: "Could not load workspace information.", module: "Module", intent: "Intent", workspaceSaved: "The current work bot was saved.", title: "Bot Workspace", description: "Select an existing bot and version to continue working.", save: "Save", groupSelection: "Select Group", defaultGroup: "Default Group", accessibleBots: "Accessible Bots", currentWorkBot: "Current Work Bot", recentWork: "Recent Work", countUnit: "", none: "None", currentTarget: "Current Work Target", currentTargetDescription: "Work with the selected bot.", selectBot: "Select Bot", group: "Group", bot: "Bot", version: "Version", status: "Status", language: "Language", lastWork: "Last Work", openSettings: "Open Bot Settings", openConfiguration: "Open Bot Configuration", openManagement: "Open Bot Management", openBuild: "Open Bot Build", recentBots: "Recently Used Bots", workTime: "Work Time", currentBot: "Current Bot", noRecentBots: "No recent work.", workItems: "Work Items", workItemsDescription: "Review the current bot's intents and modules.", category: "Type", intentModuleName: "Intent/Module Name", noWorkItems: "No work items are registered.", evaluationDiagnostics: "Evaluation Diagnostics", misclassified: "Misclassified Utterances", utterance: "Utterance", expectedIntent: "Expected Intent", predictedIntentScore: "Predicted Intent / Score", noMisclassified: "No misclassified utterances.", lowScore: "Low-Score Utterances", score: "Score", noLowScore: "No low-score utterances.", similarIntentCollisions: "Similar Intent Collisions", predictedIntent: "Predicted Intent", cases: "Cases", noCollisions: "No collisions" },
  "zh-CN": { loadBotsError: "无法加载机器人列表。", loadWorkspaceError: "无法加载工作区信息。", module: "模块", intent: "意图", workspaceSaved: "已保存当前工作机器人。", title: "机器人工作区", description: "选择已创建的机器人和版本以继续工作。", save: "保存", groupSelection: "选择组", defaultGroup: "默认组", accessibleBots: "组内可访问机器人", currentWorkBot: "当前工作机器人", recentWork: "最近工作", countUnit: "个", none: "无", currentTarget: "当前工作对象", currentTargetDescription: "基于所选机器人进行工作。", selectBot: "选择机器人", group: "组", bot: "机器人", version: "版本", status: "状态", language: "语言", lastWork: "最后工作", openSettings: "打开机器人设置", openConfiguration: "打开机器人配置", openManagement: "打开机器人管理", openBuild: "打开机器人制作", recentBots: "最近工作机器人", workTime: "工作时间", currentBot: "当前机器人", noRecentBots: "没有最近工作记录。", workItems: "工作项", workItemsDescription: "查看当前机器人的意图和模块。", category: "分类", intentModuleName: "意图/模块名称", noWorkItems: "没有已登记的工作项。", evaluationDiagnostics: "评估诊断", misclassified: "误分类语句", utterance: "语句", expectedIntent: "正确意图", predictedIntentScore: "预测意图 / Score", noMisclassified: "没有误分类语句。", lowScore: "低 Score 语句", score: "Score", noLowScore: "没有低 Score 语句。", similarIntentCollisions: "相似意图冲突", predictedIntent: "预测意图", cases: "数量", noCollisions: "无冲突" },
  ja: { loadBotsError: "ボット一覧を読み込めませんでした。", loadWorkspaceError: "作業領域の情報を読み込めませんでした。", module: "モジュール", intent: "意図", workspaceSaved: "現在の作業ボットを保存しました。", title: "ボット作業領域", description: "作成済みのボットとバージョンを選択して作業を続けます。", save: "保存", groupSelection: "グループ選択", defaultGroup: "既定グループ", accessibleBots: "アクセス可能なボット", currentWorkBot: "現在の作業ボット", recentWork: "最近の作業", countUnit: "件", none: "なし", currentTarget: "現在の作業対象", currentTargetDescription: "選択したボットを基準に作業します。", selectBot: "ボット選択", group: "グループ", bot: "ボット", version: "バージョン", status: "状態", language: "言語", lastWork: "最終作業", openSettings: "ボット設定を開く", openConfiguration: "ボット構成を開く", openManagement: "ボット管理を開く", openBuild: "ボット作成を開く", recentBots: "最近の作業ボット", workTime: "作業時刻", currentBot: "現在のボット", noRecentBots: "最近の作業はありません。", workItems: "作業項目", workItemsDescription: "現在のボットの意図とモジュールを確認します。", category: "区分", intentModuleName: "意図/モジュール名", noWorkItems: "登録済みの作業項目がありません。", evaluationDiagnostics: "評価診断", misclassified: "誤分類文", utterance: "文", expectedIntent: "正解意図", predictedIntentScore: "予測意図 / Score", noMisclassified: "誤分類文はありません。", lowScore: "低 Score 文", score: "Score", noLowScore: "低 Score 文はありません。", similarIntentCollisions: "類似意図の衝突", predictedIntent: "予測意図", cases: "件数", noCollisions: "衝突なし" },
  vi: { loadBotsError: "Không thể tải danh sách bot.", loadWorkspaceError: "Không thể tải thông tin không gian làm việc.", module: "Mô-đun", intent: "Ý định", workspaceSaved: "Đã lưu bot làm việc hiện tại.", title: "Không gian làm việc bot", description: "Chọn bot và phiên bản đã tạo để tiếp tục công việc.", save: "Lưu", groupSelection: "Chọn nhóm", defaultGroup: "Nhóm mặc định", accessibleBots: "Bot có thể truy cập", currentWorkBot: "Bot làm việc hiện tại", recentWork: "Công việc gần đây", countUnit: "", none: "Không có", currentTarget: "Đối tượng làm việc hiện tại", currentTargetDescription: "Làm việc dựa trên bot đã chọn.", selectBot: "Chọn bot", group: "Nhóm", bot: "Bot", version: "Phiên bản", status: "Trạng thái", language: "Ngôn ngữ", lastWork: "Lần làm việc cuối", openSettings: "Mở cài đặt bot", openConfiguration: "Mở cấu hình bot", openManagement: "Mở quản lý bot", openBuild: "Mở xây dựng bot", recentBots: "Bot làm việc gần đây", workTime: "Thời gian", currentBot: "Bot hiện tại", noRecentBots: "Không có công việc gần đây.", workItems: "Mục công việc", workItemsDescription: "Xem ý định và mô-đun của bot hiện tại.", category: "Loại", intentModuleName: "Tên ý định/mô-đun", noWorkItems: "Chưa đăng ký mục công việc.", evaluationDiagnostics: "Chẩn đoán đánh giá", misclassified: "Câu phân loại sai", utterance: "Câu", expectedIntent: "Ý định đúng", predictedIntentScore: "Ý định dự đoán / Score", noMisclassified: "Không có câu phân loại sai.", lowScore: "Câu Score thấp", score: "Score", noLowScore: "Không có câu Score thấp.", similarIntentCollisions: "Xung đột ý định tương tự", predictedIntent: "Ý định dự đoán", cases: "Số lượng", noCollisions: "Không có xung đột" },
  fr: { loadBotsError: "Impossible de charger la liste des bots.", loadWorkspaceError: "Impossible de charger l'espace de travail.", module: "Module", intent: "Intention", workspaceSaved: "Le bot de travail actuel a été enregistré.", title: "Espace de travail du bot", description: "Sélectionnez un bot et une version existants pour continuer.", save: "Enregistrer", groupSelection: "Sélection du groupe", defaultGroup: "Groupe par défaut", accessibleBots: "Bots accessibles", currentWorkBot: "Bot de travail actuel", recentWork: "Travail récent", countUnit: "", none: "Aucun", currentTarget: "Cible de travail actuelle", currentTargetDescription: "Travaillez à partir du bot sélectionné.", selectBot: "Sélectionner le bot", group: "Groupe", bot: "Bot", version: "Version", status: "État", language: "Langue", lastWork: "Dernier travail", openSettings: "Ouvrir les paramètres", openConfiguration: "Ouvrir la configuration", openManagement: "Ouvrir la gestion", openBuild: "Ouvrir la création", recentBots: "Bots récemment utilisés", workTime: "Heure de travail", currentBot: "Bot actuel", noRecentBots: "Aucun travail récent.", workItems: "Éléments de travail", workItemsDescription: "Consultez les intentions et modules du bot actuel.", category: "Type", intentModuleName: "Nom de l'intention/du module", noWorkItems: "Aucun élément de travail enregistré.", evaluationDiagnostics: "Diagnostic d'évaluation", misclassified: "Phrases mal classées", utterance: "Phrase", expectedIntent: "Intention correcte", predictedIntentScore: "Intention prédite / Score", noMisclassified: "Aucune phrase mal classée.", lowScore: "Phrases à Score faible", score: "Score", noLowScore: "Aucune phrase à Score faible.", similarIntentCollisions: "Collisions d'intentions similaires", predictedIntent: "Intention prédite", cases: "Nombre", noCollisions: "Aucune collision" },
  de: { loadBotsError: "Die Bot-Liste konnte nicht geladen werden.", loadWorkspaceError: "Die Arbeitsbereichsinformationen konnten nicht geladen werden.", module: "Modul", intent: "Intent", workspaceSaved: "Der aktuelle Arbeits-Bot wurde gespeichert.", title: "Bot-Arbeitsbereich", description: "Wählen Sie einen vorhandenen Bot und eine Version, um weiterzuarbeiten.", save: "Speichern", groupSelection: "Gruppe auswählen", defaultGroup: "Standardgruppe", accessibleBots: "Zugängliche Bots", currentWorkBot: "Aktueller Arbeits-Bot", recentWork: "Letzte Arbeit", countUnit: "", none: "Keine", currentTarget: "Aktuelles Arbeitsziel", currentTargetDescription: "Arbeiten Sie mit dem ausgewählten Bot.", selectBot: "Bot auswählen", group: "Gruppe", bot: "Bot", version: "Version", status: "Status", language: "Sprache", lastWork: "Letzte Arbeit", openSettings: "Bot-Einstellungen öffnen", openConfiguration: "Bot-Konfiguration öffnen", openManagement: "Bot-Verwaltung öffnen", openBuild: "Bot-Erstellung öffnen", recentBots: "Zuletzt verwendete Bots", workTime: "Arbeitszeit", currentBot: "Aktueller Bot", noRecentBots: "Keine letzte Arbeit.", workItems: "Arbeitselemente", workItemsDescription: "Prüfen Sie die Intents und Module des aktuellen Bots.", category: "Typ", intentModuleName: "Intent-/Modulname", noWorkItems: "Keine Arbeitselemente registriert.", evaluationDiagnostics: "Bewertungsdiagnose", misclassified: "Fehlklassifizierte Sätze", utterance: "Satz", expectedIntent: "Richtiger Intent", predictedIntentScore: "Vorhergesagter Intent / Score", noMisclassified: "Keine fehlklassifizierten Sätze.", lowScore: "Sätze mit niedrigem Score", score: "Score", noLowScore: "Keine Sätze mit niedrigem Score.", similarIntentCollisions: "Ähnliche Intent-Kollisionen", predictedIntent: "Vorhergesagter Intent", cases: "Anzahl", noCollisions: "Keine Kollisionen" },
} satisfies Record<SupportedLanguage, BotWorkspaceCatalog>;
