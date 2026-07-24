import type { SupportedLanguage } from "@/lib/language";

export type BotManagementCatalog = {
  loadBotsError: string;
  loadVersionsError: string;
  deleteConfirm: string;
  emptyVersionComment: string;
  versionAdded: string;
  versionCopied: string;
  versionDeleted: string;
  activeVersionUnset: string;
  activeVersionSet: string;
  versionActionError: string;
  aidotDownloaded: string;
  versionDownloaded: string;
  downloadError: string;
  aidotUploaded: string;
  invalidVersionFile: string;
  versionUploaded: string;
  uploadError: string;
  title: string;
  description: string;
  createBot: string;
  group: string;
  botCount: string;
  selectedBot: string;
  versionItems: string;
  workVersion: string;
  activeVersion: string;
  countUnit: string;
  botList: string;
  botListDescription: string;
  locale: string;
  noBots: string;
  assetsAndVersions: string;
  assetsAndVersionsDescription: string;
  addVersion: string;
  copy: string;
  delete: string;
  uploadVersion: string;
  downloadVersion: string;
  toggleActive: string;
  select: string;
  version: string;
  status: string;
  lastTrainingEngine: string;
  intents: string;
  entities: string;
  dictionary: string;
  api: string;
  evaluation: string;
  modifiedAt: string;
  modifiedBy: string;
  note: string;
  activeVersionNote: string;
  workVersionNote: string;
  noVersionHistory: string;
  detailTitle: string;
  detailDescription: string;
  botId: string;
  botName: string;
  language: string;
  nluType: string;
  nluModel: string;
  answerMode: string;
  versionList: string;
  updated: string;
  aidotPackageDownload: string;
  currentWorkVersionOne: string;
  aidotPackageUpload: string;
  applyToCurrentWorkVersion: string;
  loading: string;
  assetSummary: string;
  activeStatus: string;
  testingStatus: string;
  inactiveStatus: string;
};

export const BOT_MANAGEMENT_CATALOGS = {
  ko: {
    loadBotsError: "봇 목록을 불러오지 못했습니다.", loadVersionsError: "버전 목록을 불러오지 못했습니다.", deleteConfirm: "{name} 버전을 삭제하시겠습니까?", emptyVersionComment: "빈 새 버전", versionAdded: "{name} 버전을 추가했습니다.", versionCopied: "{name} 버전을 복사했습니다.", versionDeleted: "{name} 버전을 삭제했습니다.", activeVersionUnset: "운영 버전을 해제했습니다.", activeVersionSet: "운영 버전을 적용했습니다.", versionActionError: "버전 작업에 실패했습니다.", aidotDownloaded: "Aidot 봇 패키지를 다운로드했습니다.", versionDownloaded: "버전 파일을 다운로드했습니다.", downloadError: "파일 다운로드에 실패했습니다.", aidotUploaded: "Aidot 봇 패키지 {name}을 업로드했습니다.", invalidVersionFile: "버전 파일 형식이 맞지 않습니다.", versionUploaded: "버전 파일 {name}을 업로드했습니다.", uploadError: "JSON 파일 업로드에 실패했습니다.",
    title: "봇 관리", description: "봇 단위 자산/버전/운영 상태를 Aidot 호환 기준으로 관리합니다.", createBot: "+ 봇 생성", group: "그룹", botCount: "봇 수", selectedBot: "선택 봇", versionItems: "버전 항목", workVersion: "작업 버전", activeVersion: "운영 버전", countUnit: "개", botList: "봇 목록 조회", botListDescription: "그룹 내 봇 목록과 기본 상태입니다.", locale: "언어", noBots: "관리할 봇이 없습니다.", assetsAndVersions: "봇 자산 / 버전", assetsAndVersionsDescription: "작업 버전과 운영 버전을 구분해 관리합니다.", addVersion: "버전 추가", copy: "복사", delete: "삭제", uploadVersion: "버전 파일 업로드", downloadVersion: "버전 파일 다운로드", toggleActive: "운영/해제",
    select: "선택", version: "버전", status: "상태", lastTrainingEngine: "최종 학습 엔진", intents: "의도", entities: "개체", dictionary: "사전", api: "API", evaluation: "평가", modifiedAt: "최종수정일시", modifiedBy: "최종수정자", note: "비고", activeVersionNote: "운영 버전", workVersionNote: "작업 버전", noVersionHistory: "버전 이력이 없습니다.", detailTitle: "봇 상세 정보 및 호환 운영", detailDescription: "선택한 작업 버전 패키지와 운영 상태를 관리합니다.", botId: "봇 ID", botName: "봇 이름", language: "언어", nluType: "NLU 방식", nluModel: "NLU 모델", answerMode: "답변 방식", versionList: "버전 목록", updated: "업데이트", aidotPackageDownload: "Aidot 봇 패키지 다운로드", currentWorkVersionOne: "현재 작업 버전 1개", aidotPackageUpload: "Aidot 봇 패키지 업로드", applyToCurrentWorkVersion: "현재 작업 버전에 반영", loading: "봇 정보를 불러오는 중입니다.", assetSummary: "의도 {intents} · 개체 {entities} · 사전 {dictionary} · API {apis}", activeStatus: "운영", testingStatus: "테스트", inactiveStatus: "비활성",
  },
  en: {
    loadBotsError: "Could not load the bot list.", loadVersionsError: "Could not load the version list.", deleteConfirm: "Delete version {name}?", emptyVersionComment: "New empty version", versionAdded: "Version {name} was added.", versionCopied: "Version {name} was copied.", versionDeleted: "Version {name} was deleted.", activeVersionUnset: "The production version was unset.", activeVersionSet: "The production version was applied.", versionActionError: "The version operation failed.", aidotDownloaded: "The Aidot bot package was downloaded.", versionDownloaded: "The version file was downloaded.", downloadError: "The file download failed.", aidotUploaded: "Aidot bot package {name} was uploaded.", invalidVersionFile: "The version file format is invalid.", versionUploaded: "Version file {name} was uploaded.", uploadError: "The JSON file upload failed.",
    title: "Bot Management", description: "Manage bot assets, versions, and production status with Aidot compatibility.", createBot: "+ Create Bot", group: "Group", botCount: "Bots", selectedBot: "Selected Bot", versionItems: "Versions", workVersion: "Work Version", activeVersion: "Production Version", countUnit: "", botList: "Bot List", botListDescription: "Bots and their basic status in the group.", locale: "Locale", noBots: "There are no bots to manage.", assetsAndVersions: "Bot Assets / Versions", assetsAndVersionsDescription: "Manage work and production versions separately.", addVersion: "Add Version", copy: "Copy", delete: "Delete", uploadVersion: "Upload Version File", downloadVersion: "Download Version File", toggleActive: "Apply/Unset",
    select: "Select", version: "Version", status: "Status", lastTrainingEngine: "Last Training Engine", intents: "Intents", entities: "Entities", dictionary: "Dictionary", api: "API", evaluation: "Evaluation", modifiedAt: "Last Modified", modifiedBy: "Modified By", note: "Note", activeVersionNote: "Production version", workVersionNote: "Work version", noVersionHistory: "No version history.", detailTitle: "Bot Details and Compatible Operations", detailDescription: "Manage the selected work-version package and production status.", botId: "Bot ID", botName: "Bot Name", language: "Language", nluType: "NLU Type", nluModel: "NLU Model", answerMode: "Answer Mode", versionList: "Version Count", updated: "Updated", aidotPackageDownload: "Download Aidot Bot Package", currentWorkVersionOne: "Current work version", aidotPackageUpload: "Upload Aidot Bot Package", applyToCurrentWorkVersion: "Apply to current work version", loading: "Loading bot information.", assetSummary: "Intents {intents} · Entities {entities} · Dictionary {dictionary} · API {apis}", activeStatus: "Production", testingStatus: "Testing", inactiveStatus: "Inactive",
  },
  "zh-CN": {
    loadBotsError: "无法加载机器人列表。", loadVersionsError: "无法加载版本列表。", deleteConfirm: "要删除版本 {name} 吗？", emptyVersionComment: "新建空版本", versionAdded: "已添加版本 {name}。", versionCopied: "已复制版本 {name}。", versionDeleted: "已删除版本 {name}。", activeVersionUnset: "已取消生产版本。", activeVersionSet: "已应用生产版本。", versionActionError: "版本操作失败。", aidotDownloaded: "已下载 Aidot 机器人包。", versionDownloaded: "已下载版本文件。", downloadError: "文件下载失败。", aidotUploaded: "已上传 Aidot 机器人包 {name}。", invalidVersionFile: "版本文件格式不正确。", versionUploaded: "已上传版本文件 {name}。", uploadError: "JSON 文件上传失败。",
    title: "机器人管理", description: "按照 Aidot 兼容标准管理机器人资产、版本和生产状态。", createBot: "+ 创建机器人", group: "组", botCount: "机器人数", selectedBot: "所选机器人", versionItems: "版本项", workVersion: "工作版本", activeVersion: "生产版本", countUnit: "个", botList: "机器人列表", botListDescription: "组内机器人列表和基本状态。", locale: "语言", noBots: "没有可管理的机器人。", assetsAndVersions: "机器人资产 / 版本", assetsAndVersionsDescription: "分别管理工作版本和生产版本。", addVersion: "添加版本", copy: "复制", delete: "删除", uploadVersion: "上传版本文件", downloadVersion: "下载版本文件", toggleActive: "应用/取消",
    select: "选择", version: "版本", status: "状态", lastTrainingEngine: "最近训练引擎", intents: "意图", entities: "实体", dictionary: "词典", api: "API", evaluation: "评估", modifiedAt: "最后修改时间", modifiedBy: "最后修改人", note: "备注", activeVersionNote: "生产版本", workVersionNote: "工作版本", noVersionHistory: "没有版本历史。", detailTitle: "机器人详情与兼容运营", detailDescription: "管理所选工作版本包和生产状态。", botId: "机器人 ID", botName: "机器人名称", language: "语言", nluType: "NLU 方式", nluModel: "NLU 模型", answerMode: "回答方式", versionList: "版本数", updated: "更新时间", aidotPackageDownload: "下载 Aidot 机器人包", currentWorkVersionOne: "当前工作版本", aidotPackageUpload: "上传 Aidot 机器人包", applyToCurrentWorkVersion: "应用到当前工作版本", loading: "正在加载机器人信息。", assetSummary: "意图 {intents} · 实体 {entities} · 词典 {dictionary} · API {apis}", activeStatus: "生产", testingStatus: "测试", inactiveStatus: "停用",
  },
  ja: {
    loadBotsError: "ボット一覧を読み込めませんでした。", loadVersionsError: "バージョン一覧を読み込めませんでした。", deleteConfirm: "バージョン {name} を削除しますか？", emptyVersionComment: "新しい空のバージョン", versionAdded: "バージョン {name} を追加しました。", versionCopied: "バージョン {name} をコピーしました。", versionDeleted: "バージョン {name} を削除しました。", activeVersionUnset: "運用バージョンを解除しました。", activeVersionSet: "運用バージョンを適用しました。", versionActionError: "バージョン操作に失敗しました。", aidotDownloaded: "Aidot ボットパッケージをダウンロードしました。", versionDownloaded: "バージョンファイルをダウンロードしました。", downloadError: "ファイルのダウンロードに失敗しました。", aidotUploaded: "Aidot ボットパッケージ {name} をアップロードしました。", invalidVersionFile: "バージョンファイルの形式が正しくありません。", versionUploaded: "バージョンファイル {name} をアップロードしました。", uploadError: "JSON ファイルのアップロードに失敗しました。",
    title: "ボット管理", description: "Aidot 互換基準でボットの資産、バージョン、運用状態を管理します。", createBot: "+ ボット作成", group: "グループ", botCount: "ボット数", selectedBot: "選択ボット", versionItems: "バージョン項目", workVersion: "作業バージョン", activeVersion: "運用バージョン", countUnit: "件", botList: "ボット一覧", botListDescription: "グループ内のボット一覧と基本状態です。", locale: "言語", noBots: "管理するボットがありません。", assetsAndVersions: "ボット資産 / バージョン", assetsAndVersionsDescription: "作業バージョンと運用バージョンを分けて管理します。", addVersion: "バージョン追加", copy: "コピー", delete: "削除", uploadVersion: "バージョンファイルをアップロード", downloadVersion: "バージョンファイルをダウンロード", toggleActive: "運用/解除",
    select: "選択", version: "バージョン", status: "状態", lastTrainingEngine: "最終学習エンジン", intents: "意図", entities: "エンティティ", dictionary: "辞書", api: "API", evaluation: "評価", modifiedAt: "最終更新日時", modifiedBy: "最終更新者", note: "備考", activeVersionNote: "運用バージョン", workVersionNote: "作業バージョン", noVersionHistory: "バージョン履歴がありません。", detailTitle: "ボット詳細情報と互換運用", detailDescription: "選択した作業バージョンのパッケージと運用状態を管理します。", botId: "ボット ID", botName: "ボット名", language: "言語", nluType: "NLU 方式", nluModel: "NLU モデル", answerMode: "回答方式", versionList: "バージョン数", updated: "更新", aidotPackageDownload: "Aidot ボットパッケージをダウンロード", currentWorkVersionOne: "現在の作業バージョン", aidotPackageUpload: "Aidot ボットパッケージをアップロード", applyToCurrentWorkVersion: "現在の作業バージョンに反映", loading: "ボット情報を読み込んでいます。", assetSummary: "意図 {intents} · エンティティ {entities} · 辞書 {dictionary} · API {apis}", activeStatus: "運用", testingStatus: "テスト", inactiveStatus: "無効",
  },
  vi: {
    loadBotsError: "Không thể tải danh sách bot.", loadVersionsError: "Không thể tải danh sách phiên bản.", deleteConfirm: "Xóa phiên bản {name}?", emptyVersionComment: "Phiên bản trống mới", versionAdded: "Đã thêm phiên bản {name}.", versionCopied: "Đã sao chép phiên bản {name}.", versionDeleted: "Đã xóa phiên bản {name}.", activeVersionUnset: "Đã bỏ phiên bản vận hành.", activeVersionSet: "Đã áp dụng phiên bản vận hành.", versionActionError: "Thao tác phiên bản thất bại.", aidotDownloaded: "Đã tải gói bot Aidot.", versionDownloaded: "Đã tải tệp phiên bản.", downloadError: "Tải tệp thất bại.", aidotUploaded: "Đã tải lên gói bot Aidot {name}.", invalidVersionFile: "Định dạng tệp phiên bản không hợp lệ.", versionUploaded: "Đã tải lên tệp phiên bản {name}.", uploadError: "Tải lên tệp JSON thất bại.",
    title: "Quản lý bot", description: "Quản lý tài sản, phiên bản và trạng thái vận hành của bot theo chuẩn tương thích Aidot.", createBot: "+ Tạo bot", group: "Nhóm", botCount: "Số bot", selectedBot: "Bot đã chọn", versionItems: "Mục phiên bản", workVersion: "Phiên bản làm việc", activeVersion: "Phiên bản vận hành", countUnit: "", botList: "Danh sách bot", botListDescription: "Danh sách bot và trạng thái cơ bản trong nhóm.", locale: "Ngôn ngữ", noBots: "Không có bot để quản lý.", assetsAndVersions: "Tài sản / Phiên bản bot", assetsAndVersionsDescription: "Quản lý riêng phiên bản làm việc và vận hành.", addVersion: "Thêm phiên bản", copy: "Sao chép", delete: "Xóa", uploadVersion: "Tải lên tệp phiên bản", downloadVersion: "Tải xuống tệp phiên bản", toggleActive: "Áp dụng/Bỏ",
    select: "Chọn", version: "Phiên bản", status: "Trạng thái", lastTrainingEngine: "Engine huấn luyện gần nhất", intents: "Ý định", entities: "Thực thể", dictionary: "Từ điển", api: "API", evaluation: "Đánh giá", modifiedAt: "Sửa lần cuối", modifiedBy: "Người sửa", note: "Ghi chú", activeVersionNote: "Phiên bản vận hành", workVersionNote: "Phiên bản làm việc", noVersionHistory: "Không có lịch sử phiên bản.", detailTitle: "Chi tiết bot và vận hành tương thích", detailDescription: "Quản lý gói phiên bản làm việc đã chọn và trạng thái vận hành.", botId: "ID bot", botName: "Tên bot", language: "Ngôn ngữ", nluType: "Kiểu NLU", nluModel: "Mô hình NLU", answerMode: "Cách trả lời", versionList: "Số phiên bản", updated: "Cập nhật", aidotPackageDownload: "Tải gói bot Aidot", currentWorkVersionOne: "Phiên bản làm việc hiện tại", aidotPackageUpload: "Tải lên gói bot Aidot", applyToCurrentWorkVersion: "Áp dụng vào phiên bản làm việc hiện tại", loading: "Đang tải thông tin bot.", assetSummary: "Ý định {intents} · Thực thể {entities} · Từ điển {dictionary} · API {apis}", activeStatus: "Vận hành", testingStatus: "Kiểm thử", inactiveStatus: "Không hoạt động",
  },
  fr: {
    loadBotsError: "Impossible de charger la liste des bots.", loadVersionsError: "Impossible de charger la liste des versions.", deleteConfirm: "Supprimer la version {name} ?", emptyVersionComment: "Nouvelle version vide", versionAdded: "La version {name} a été ajoutée.", versionCopied: "La version {name} a été copiée.", versionDeleted: "La version {name} a été supprimée.", activeVersionUnset: "La version de production a été retirée.", activeVersionSet: "La version de production a été appliquée.", versionActionError: "L'opération sur la version a échoué.", aidotDownloaded: "Le package de bot Aidot a été téléchargé.", versionDownloaded: "Le fichier de version a été téléchargé.", downloadError: "Le téléchargement du fichier a échoué.", aidotUploaded: "Le package de bot Aidot {name} a été importé.", invalidVersionFile: "Le format du fichier de version est incorrect.", versionUploaded: "Le fichier de version {name} a été importé.", uploadError: "L'import du fichier JSON a échoué.",
    title: "Gestion des bots", description: "Gérez les ressources, les versions et l'état de production selon la compatibilité Aidot.", createBot: "+ Créer un bot", group: "Groupe", botCount: "Bots", selectedBot: "Bot sélectionné", versionItems: "Versions", workVersion: "Version de travail", activeVersion: "Version de production", countUnit: "", botList: "Liste des bots", botListDescription: "Bots du groupe et leur état principal.", locale: "Langue", noBots: "Aucun bot à gérer.", assetsAndVersions: "Ressources / Versions du bot", assetsAndVersionsDescription: "Gérez séparément les versions de travail et de production.", addVersion: "Ajouter une version", copy: "Copier", delete: "Supprimer", uploadVersion: "Importer un fichier de version", downloadVersion: "Télécharger le fichier de version", toggleActive: "Appliquer/Retirer",
    select: "Sélection", version: "Version", status: "État", lastTrainingEngine: "Dernier moteur d'entraînement", intents: "Intentions", entities: "Entités", dictionary: "Dictionnaire", api: "API", evaluation: "Évaluation", modifiedAt: "Dernière modification", modifiedBy: "Modifié par", note: "Note", activeVersionNote: "Version de production", workVersionNote: "Version de travail", noVersionHistory: "Aucun historique de version.", detailTitle: "Détails du bot et exploitation compatible", detailDescription: "Gérez le package de la version de travail sélectionnée et son état de production.", botId: "ID du bot", botName: "Nom du bot", language: "Langue", nluType: "Type NLU", nluModel: "Modèle NLU", answerMode: "Mode de réponse", versionList: "Nombre de versions", updated: "Mise à jour", aidotPackageDownload: "Télécharger le package de bot Aidot", currentWorkVersionOne: "Version de travail actuelle", aidotPackageUpload: "Importer le package de bot Aidot", applyToCurrentWorkVersion: "Appliquer à la version de travail actuelle", loading: "Chargement des informations du bot.", assetSummary: "Intentions {intents} · Entités {entities} · Dictionnaire {dictionary} · API {apis}", activeStatus: "Production", testingStatus: "Test", inactiveStatus: "Inactif",
  },
  de: {
    loadBotsError: "Die Bot-Liste konnte nicht geladen werden.", loadVersionsError: "Die Versionsliste konnte nicht geladen werden.", deleteConfirm: "Version {name} löschen?", emptyVersionComment: "Neue leere Version", versionAdded: "Version {name} wurde hinzugefügt.", versionCopied: "Version {name} wurde kopiert.", versionDeleted: "Version {name} wurde gelöscht.", activeVersionUnset: "Die Produktionsversion wurde aufgehoben.", activeVersionSet: "Die Produktionsversion wurde angewendet.", versionActionError: "Der Versionsvorgang ist fehlgeschlagen.", aidotDownloaded: "Das Aidot-Bot-Paket wurde heruntergeladen.", versionDownloaded: "Die Versionsdatei wurde heruntergeladen.", downloadError: "Der Dateidownload ist fehlgeschlagen.", aidotUploaded: "Das Aidot-Bot-Paket {name} wurde hochgeladen.", invalidVersionFile: "Das Format der Versionsdatei ist ungültig.", versionUploaded: "Die Versionsdatei {name} wurde hochgeladen.", uploadError: "Der JSON-Dateiupload ist fehlgeschlagen.",
    title: "Bot-Verwaltung", description: "Verwalten Sie Bot-Ressourcen, Versionen und Produktionsstatus nach Aidot-Kompatibilität.", createBot: "+ Bot erstellen", group: "Gruppe", botCount: "Bots", selectedBot: "Ausgewählter Bot", versionItems: "Versionen", workVersion: "Arbeitsversion", activeVersion: "Produktionsversion", countUnit: "", botList: "Bot-Liste", botListDescription: "Bots in der Gruppe und ihr Grundstatus.", locale: "Sprache", noBots: "Keine Bots zu verwalten.", assetsAndVersions: "Bot-Ressourcen / Versionen", assetsAndVersionsDescription: "Arbeits- und Produktionsversionen getrennt verwalten.", addVersion: "Version hinzufügen", copy: "Kopieren", delete: "Löschen", uploadVersion: "Versionsdatei hochladen", downloadVersion: "Versionsdatei herunterladen", toggleActive: "Anwenden/Aufheben",
    select: "Auswahl", version: "Version", status: "Status", lastTrainingEngine: "Letzte Trainings-Engine", intents: "Intents", entities: "Entitäten", dictionary: "Wörterbuch", api: "API", evaluation: "Bewertung", modifiedAt: "Zuletzt geändert", modifiedBy: "Geändert von", note: "Notiz", activeVersionNote: "Produktionsversion", workVersionNote: "Arbeitsversion", noVersionHistory: "Kein Versionsverlauf.", detailTitle: "Bot-Details und kompatibler Betrieb", detailDescription: "Verwalten Sie das ausgewählte Arbeitsversionspaket und den Produktionsstatus.", botId: "Bot-ID", botName: "Bot-Name", language: "Sprache", nluType: "NLU-Typ", nluModel: "NLU-Modell", answerMode: "Antwortmodus", versionList: "Versionsanzahl", updated: "Aktualisiert", aidotPackageDownload: "Aidot-Bot-Paket herunterladen", currentWorkVersionOne: "Aktuelle Arbeitsversion", aidotPackageUpload: "Aidot-Bot-Paket hochladen", applyToCurrentWorkVersion: "Auf aktuelle Arbeitsversion anwenden", loading: "Bot-Informationen werden geladen.", assetSummary: "Intents {intents} · Entitäten {entities} · Wörterbuch {dictionary} · API {apis}", activeStatus: "Produktion", testingStatus: "Test", inactiveStatus: "Inaktiv",
  },
} satisfies Record<SupportedLanguage, BotManagementCatalog>;

export function formatBotManagementText(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function botManagementStatusLabel(status: string, catalog: BotManagementCatalog): string {
  if (status === "active") return catalog.activeStatus;
  if (status === "testing") return catalog.testingStatus;
  if (status === "inactive") return catalog.inactiveStatus;
  return status;
}
