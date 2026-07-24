import type { SupportedLanguage } from "@/lib/language";

export type AdminOperationsStatusCatalog = {
  summaryLabels: Record<string, string>;
  detail: string;
  slowApi: string;
  slowDb: string;
  editAreas: Record<string, string>;
  cacheAvailability: { disabled: string; pending: string; available: string; fallback: string };
  loginRequired: string;
  filterLoadFailed: string;
  dashboardLoadFailed: string;
  integrityLoadFailed: string;
  health: {
    apiReadiness: string; healthy: string; checkRequired: string; checking: string; cache: string;
    errorCount: string; responseDelay: string; errors: string; systemQueue: string; editLocks: string;
    lockDetail: string; dbSplit: string; checkPending: string; splitDetail: string; integrityPrompt: string;
    executionConfirmed: string; available: string; disabled: string; gpuPending: string; gpuExecution: string;
    recent: string; gpuCheck: string; gpuNotRun: string; mlGpu: string; semanticGpu: string;
  };
};

const summary = (values: string[]) => Object.fromEntries([
  "total_bots", "operating_bots", "botstation_connected_bots", "active_channels", "channel_rooms", "user_messages",
  "queue_events", "queue_queued", "queue_processing", "queue_completed", "queue_failed", "runtime_events",
  "runtime_problem_events", "system_errors", "slow_api_requests", "slow_db_requests", "active_edit_locks",
  "expired_edit_locks", "edit_lock_conflicts", "api_calls", "api_errors", "intent_fallbacks", "training_success", "training_failed",
].map((key, index) => [key, values[index]]));

export const ADMIN_OPERATIONS_STATUS_CATALOGS = {
  ko: {
    summaryLabels: summary(["전체 봇","운영 버전 봇","봇스테이션 연결","활성 채널","대화방","사용자 발화","Queue 전체","Queue 대기","Queue 처리중","Queue 완료","Queue 실패","실행 이벤트","실행 경고/오류","시스템 오류","느린 API","DB 지연","편집 잠금","만료 잠금","편집 충돌","API 호출","API 오류","의도 미분류","학습 성공","학습 확인 필요"]),
    detail:"상세", slowApi:"느린 API", slowDb:"DB 지연", editAreas:{dialog:"대화",start:"대화 시작",flow:"대화 설계",settings:"설정"},
    cacheAvailability:{disabled:"미사용",pending:"확인 대기",available:"사용 가능",fallback:"Fallback"}, loginRequired:"로그인이 필요합니다.", filterLoadFailed:"운영 필터 정보를 불러오지 못했습니다.", dashboardLoadFailed:"운영 현황을 불러오지 못했습니다.", integrityLoadFailed:"버전 무결성 상태를 불러오지 못했습니다.",
    health:{apiReadiness:"API/DB 준비",healthy:"정상",checkRequired:"확인 필요",checking:"확인 중",cache:"캐시",errorCount:"오류 {count}건",responseDelay:"응답 지연",errors:"오류",systemQueue:"시스템 {system} · Queue {queue}",editLocks:"편집 잠금",lockDetail:"활성 {active} · 만료 {expired} · 충돌 {conflicts}",dbSplit:"DB 분리",checkPending:"점검 대기",splitDetail:"분리 미적용 {missing} · 스냅샷 누락 {snapshots} · 적용 {split}/{total}",integrityPrompt:"DB 분리 상태에서 무결성 점검을 실행하세요.",executionConfirmed:"실행 확인",available:"사용 가능",disabled:"미사용",gpuPending:"확인 대기",gpuExecution:"컨테이너 시작 후 {count}회",recent:"최근 {date}",gpuCheck:"CUDA 또는 엔진 상태를 확인하세요.",gpuNotRun:"GPU 연산이 아직 실행되지 않았습니다.",mlGpu:"ML GPU",semanticGpu:"시멘틱 GPU"},
  },
  en: {
    summaryLabels: summary(["Total bots","Operating versions","Botstation connected","Active channels","Conversation rooms","User utterances","Queue total","Queue waiting","Queue processing","Queue completed","Queue failed","Runtime events","Runtime warnings/errors","System errors","Slow API","DB latency","Edit locks","Expired locks","Edit conflicts","API calls","API errors","Intent fallback","Training success","Training needs review"]),
    detail:"Details", slowApi:"Slow API", slowDb:"DB latency", editAreas:{dialog:"Conversation",start:"Conversation start",flow:"Conversation design",settings:"Settings"},
    cacheAvailability:{disabled:"Disabled",pending:"Pending",available:"Available",fallback:"Fallback"}, loginRequired:"Login is required.", filterLoadFailed:"Could not load operation filters.", dashboardLoadFailed:"Could not load operation status.", integrityLoadFailed:"Could not load version integrity status.",
    health:{apiReadiness:"API/DB readiness",healthy:"Healthy",checkRequired:"Needs review",checking:"Checking",cache:"Cache",errorCount:"{count} errors",responseDelay:"Response latency",errors:"Errors",systemQueue:"System {system} · Queue {queue}",editLocks:"Edit locks",lockDetail:"Active {active} · Expired {expired} · Conflicts {conflicts}",dbSplit:"DB split",checkPending:"Check pending",splitDetail:"Not split {missing} · Snapshots missing {snapshots} · Applied {split}/{total}",integrityPrompt:"Run the integrity check for DB split status.",executionConfirmed:"Execution confirmed",available:"Available",disabled:"Disabled",gpuPending:"Pending",gpuExecution:"{count} executions since container start",recent:"Latest {date}",gpuCheck:"Check CUDA or engine status.",gpuNotRun:"GPU computation has not run yet.",mlGpu:"ML GPU",semanticGpu:"Semantic GPU"},
  },
  "zh-CN": {
    summaryLabels: summary(["机器人总数","运行版本机器人","Botstation连接","活跃渠道","会话房间","用户发言","Queue总数","Queue等待","Queue处理中","Queue完成","Queue失败","运行事件","运行警告/错误","系统错误","慢速API","DB延迟","编辑锁","过期锁","编辑冲突","API调用","API错误","意图未分类","训练成功","训练需确认"]),
    detail:"详情", slowApi:"慢速API", slowDb:"DB延迟", editAreas:{dialog:"会话",start:"会话开始",flow:"会话设计",settings:"设置"},
    cacheAvailability:{disabled:"未使用",pending:"待确认",available:"可用",fallback:"Fallback"}, loginRequired:"需要登录。", filterLoadFailed:"无法加载运营筛选信息。", dashboardLoadFailed:"无法加载运营状态。", integrityLoadFailed:"无法加载版本完整性状态。",
    health:{apiReadiness:"API/DB准备",healthy:"正常",checkRequired:"需要确认",checking:"确认中",cache:"缓存",errorCount:"错误{count}项",responseDelay:"响应延迟",errors:"错误",systemQueue:"系统 {system} · Queue {queue}",editLocks:"编辑锁",lockDetail:"活跃 {active} · 过期 {expired} · 冲突 {conflicts}",dbSplit:"DB拆分",checkPending:"等待检查",splitDetail:"未拆分 {missing} · 快照缺失 {snapshots} · 已应用 {split}/{total}",integrityPrompt:"请对DB拆分状态执行完整性检查。",executionConfirmed:"已确认执行",available:"可用",disabled:"未使用",gpuPending:"待确认",gpuExecution:"容器启动后执行{count}次",recent:"最近 {date}",gpuCheck:"请检查CUDA或引擎状态。",gpuNotRun:"GPU运算尚未执行。",mlGpu:"ML GPU",semanticGpu:"语义GPU"},
  },
  ja: {
    summaryLabels: summary(["全ボット","運用バージョンボット","Botstation接続","有効チャネル","会話ルーム","ユーザー発話","Queue全体","Queue待機","Queue処理中","Queue完了","Queue失敗","実行イベント","実行警告/エラー","システムエラー","遅いAPI","DB遅延","編集ロック","期限切れロック","編集競合","API呼出","APIエラー","意図未分類","学習成功","学習要確認"]),
    detail:"詳細", slowApi:"遅いAPI", slowDb:"DB遅延", editAreas:{dialog:"会話",start:"会話開始",flow:"会話設計",settings:"設定"},
    cacheAvailability:{disabled:"未使用",pending:"確認待ち",available:"利用可能",fallback:"Fallback"}, loginRequired:"ログインが必要です。", filterLoadFailed:"運用フィルター情報を取得できませんでした。", dashboardLoadFailed:"運用状況を取得できませんでした。", integrityLoadFailed:"バージョン整合性を取得できませんでした。",
    health:{apiReadiness:"API/DB準備",healthy:"正常",checkRequired:"要確認",checking:"確認中",cache:"キャッシュ",errorCount:"エラー {count}件",responseDelay:"応答遅延",errors:"エラー",systemQueue:"システム {system} · Queue {queue}",editLocks:"編集ロック",lockDetail:"有効 {active} · 期限切れ {expired} · 競合 {conflicts}",dbSplit:"DB分離",checkPending:"点検待ち",splitDetail:"未適用 {missing} · スナップショット不足 {snapshots} · 適用 {split}/{total}",integrityPrompt:"DB分離状態の整合性点検を実行してください。",executionConfirmed:"実行確認",available:"利用可能",disabled:"未使用",gpuPending:"確認待ち",gpuExecution:"コンテナ起動後 {count}回",recent:"最近 {date}",gpuCheck:"CUDAまたはエンジン状態を確認してください。",gpuNotRun:"GPU演算はまだ実行されていません。",mlGpu:"ML GPU",semanticGpu:"セマンティックGPU"},
  },
  vi: {
    summaryLabels: summary(["Tổng bot","Bot phiên bản vận hành","Kết nối Botstation","Kênh hoạt động","Phòng hội thoại","Phát ngôn người dùng","Tổng Queue","Queue chờ","Queue đang xử lý","Queue hoàn tất","Queue lỗi","Sự kiện chạy","Cảnh báo/lỗi chạy","Lỗi hệ thống","API chậm","Độ trễ DB","Khóa chỉnh sửa","Khóa hết hạn","Xung đột chỉnh sửa","Lệnh gọi API","Lỗi API","Ý định chưa phân loại","Huấn luyện thành công","Huấn luyện cần kiểm tra"]),
    detail:"Chi tiết", slowApi:"API chậm", slowDb:"Độ trễ DB", editAreas:{dialog:"Hội thoại",start:"Bắt đầu hội thoại",flow:"Thiết kế hội thoại",settings:"Cài đặt"},
    cacheAvailability:{disabled:"Không dùng",pending:"Chờ kiểm tra",available:"Khả dụng",fallback:"Fallback"}, loginRequired:"Cần đăng nhập.", filterLoadFailed:"Không thể tải bộ lọc vận hành.", dashboardLoadFailed:"Không thể tải trạng thái vận hành.", integrityLoadFailed:"Không thể tải trạng thái toàn vẹn phiên bản.",
    health:{apiReadiness:"Sẵn sàng API/DB",healthy:"Bình thường",checkRequired:"Cần kiểm tra",checking:"Đang kiểm tra",cache:"Cache",errorCount:"{count} lỗi",responseDelay:"Độ trễ phản hồi",errors:"Lỗi",systemQueue:"Hệ thống {system} · Queue {queue}",editLocks:"Khóa chỉnh sửa",lockDetail:"Hoạt động {active} · Hết hạn {expired} · Xung đột {conflicts}",dbSplit:"Tách DB",checkPending:"Chờ kiểm tra",splitDetail:"Chưa tách {missing} · Thiếu snapshot {snapshots} · Đã áp dụng {split}/{total}",integrityPrompt:"Hãy chạy kiểm tra toàn vẹn trạng thái tách DB.",executionConfirmed:"Đã xác nhận chạy",available:"Khả dụng",disabled:"Không dùng",gpuPending:"Chờ kiểm tra",gpuExecution:"{count} lần từ khi container khởi động",recent:"Gần nhất {date}",gpuCheck:"Kiểm tra trạng thái CUDA hoặc engine.",gpuNotRun:"Tính toán GPU chưa được chạy.",mlGpu:"ML GPU",semanticGpu:"GPU ngữ nghĩa"},
  },
  fr: {
    summaryLabels: summary(["Total des bots","Versions en production","Botstation connecté","Canaux actifs","Salles de conversation","Énoncés utilisateur","Queue totale","Queue en attente","Queue en traitement","Queue terminée","Queue échouée","Événements d’exécution","Alertes/erreurs d’exécution","Erreurs système","API lentes","Latence DB","Verrous d’édition","Verrous expirés","Conflits d’édition","Appels API","Erreurs API","Intentions non classées","Entraînement réussi","Entraînement à vérifier"]),
    detail:"Détails", slowApi:"API lente", slowDb:"Latence DB", editAreas:{dialog:"Conversation",start:"Début de conversation",flow:"Conception de conversation",settings:"Paramètres"},
    cacheAvailability:{disabled:"Désactivé",pending:"En attente",available:"Disponible",fallback:"Fallback"}, loginRequired:"Connexion requise.", filterLoadFailed:"Impossible de charger les filtres d’exploitation.", dashboardLoadFailed:"Impossible de charger l’état d’exploitation.", integrityLoadFailed:"Impossible de charger l’intégrité des versions.",
    health:{apiReadiness:"Disponibilité API/DB",healthy:"Normal",checkRequired:"À vérifier",checking:"Vérification",cache:"Cache",errorCount:"{count} erreurs",responseDelay:"Latence de réponse",errors:"Erreurs",systemQueue:"Système {system} · Queue {queue}",editLocks:"Verrous d’édition",lockDetail:"Actifs {active} · Expirés {expired} · Conflits {conflicts}",dbSplit:"Séparation DB",checkPending:"Contrôle en attente",splitDetail:"Non séparées {missing} · Instantanés manquants {snapshots} · Appliquées {split}/{total}",integrityPrompt:"Exécutez le contrôle d’intégrité de la séparation DB.",executionConfirmed:"Exécution confirmée",available:"Disponible",disabled:"Désactivé",gpuPending:"En attente",gpuExecution:"{count} exécutions depuis le démarrage",recent:"Dernière {date}",gpuCheck:"Vérifiez CUDA ou l’état du moteur.",gpuNotRun:"Le calcul GPU n’a pas encore été exécuté.",mlGpu:"GPU ML",semanticGpu:"GPU sémantique"},
  },
  de: {
    summaryLabels: summary(["Bots gesamt","Produktive Versionen","Botstation verbunden","Aktive Kanäle","Gesprächsräume","Benutzeräußerungen","Queue gesamt","Queue wartend","Queue in Verarbeitung","Queue abgeschlossen","Queue fehlgeschlagen","Laufzeitereignisse","Laufzeitwarnungen/-fehler","Systemfehler","Langsame API","DB-Latenz","Bearbeitungssperren","Abgelaufene Sperren","Bearbeitungskonflikte","API-Aufrufe","API-Fehler","Intent nicht klassifiziert","Training erfolgreich","Training prüfen"]),
    detail:"Details", slowApi:"Langsame API", slowDb:"DB-Latenz", editAreas:{dialog:"Gespräch",start:"Gesprächsstart",flow:"Gesprächsdesign",settings:"Einstellungen"},
    cacheAvailability:{disabled:"Deaktiviert",pending:"Prüfung ausstehend",available:"Verfügbar",fallback:"Fallback"}, loginRequired:"Anmeldung erforderlich.", filterLoadFailed:"Betriebsfilter konnten nicht geladen werden.", dashboardLoadFailed:"Betriebsstatus konnte nicht geladen werden.", integrityLoadFailed:"Versionsintegrität konnte nicht geladen werden.",
    health:{apiReadiness:"API/DB-Bereitschaft",healthy:"Normal",checkRequired:"Prüfung erforderlich",checking:"Wird geprüft",cache:"Cache",errorCount:"{count} Fehler",responseDelay:"Antwortlatenz",errors:"Fehler",systemQueue:"System {system} · Queue {queue}",editLocks:"Bearbeitungssperren",lockDetail:"Aktiv {active} · Abgelaufen {expired} · Konflikte {conflicts}",dbSplit:"DB-Trennung",checkPending:"Prüfung ausstehend",splitDetail:"Nicht getrennt {missing} · Snapshots fehlen {snapshots} · Angewendet {split}/{total}",integrityPrompt:"Führen Sie die Integritätsprüfung der DB-Trennung aus.",executionConfirmed:"Ausführung bestätigt",available:"Verfügbar",disabled:"Deaktiviert",gpuPending:"Prüfung ausstehend",gpuExecution:"{count} Ausführungen seit Containerstart",recent:"Zuletzt {date}",gpuCheck:"CUDA- oder Engine-Status prüfen.",gpuNotRun:"GPU-Berechnung wurde noch nicht ausgeführt.",mlGpu:"ML-GPU",semanticGpu:"Semantik-GPU"},
  },
} satisfies Record<SupportedLanguage, AdminOperationsStatusCatalog>;
