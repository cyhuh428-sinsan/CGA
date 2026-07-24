import type { SupportedLanguage } from "@/lib/language";

export type StudioOperationsDashboardCatalog = {
  statuses: Record<string, string>;
  roles: Record<string, string>;
  unspecified: string;
  count: string;
  botLoadFailed: string;
  dashboardLoadFailed: string;
  title: string;
  subtitle: string;
  refresh: string;
  myTasks: string;
  reviewQueue: string;
  approvalRequired: string;
  lockedItems: string;
  totalTasks: string;
  groupProgress: string;
  groupProgressDescription: string;
  botProgress: string;
  botProgressDescription: string;
  roleTasks: string;
  roleTasksDescription: string;
  taskStatus: string;
  taskStatusDescription: string;
  recentUpdates: string;
  recentUpdatesDescription: string;
  assignee: string;
  lastUpdated: string;
  noRecentUpdates: string;
  bottlenecks: string;
  bottlenecksDescription: string;
  lock: string;
  none: string;
  noBottlenecks: string;
  assigneeWorkload: string;
  assigneeWorkloadDescription: string;
  loading: string;
  selectedBot: string;
};

export const STUDIO_OPERATIONS_DASHBOARD_CATALOGS = {
  ko: {
    statuses: { todo: "할 일", in_progress: "진행 중", review: "검토 대기", approved: "승인 완료", blocked: "차단" },
    roles: { owner: "소유자", system_admin: "시스템 관리자", group_admin: "그룹 관리자", builder: "제작자", reviewer: "검수자", operator: "운영자", viewer: "조회자" },
    unspecified: "미지정", count: "{count}건", botLoadFailed: "봇 목록을 불러오지 못했습니다.", dashboardLoadFailed: "운영 대시보드를 불러오지 못했습니다.", title: "운영 대시보드", subtitle: "운영 대시보드 기준으로 API, 채널, 봇 상태와 알림을 확인합니다.", refresh: "새로고침", myTasks: "내 작업", reviewQueue: "검토 대기", approvalRequired: "승인 필요", lockedItems: "잠금 상태", totalTasks: "전체 작업", groupProgress: "그룹별 진행률", groupProgressDescription: "그룹 기준 진행 건수", botProgress: "봇별 진행률", botProgressDescription: "봇 단위 진행 건수", roleTasks: "권한별 할 일", roleTasksDescription: "역할 기준 누적 항목 수입니다.", taskStatus: "작업 상태", taskStatusDescription: "전체 작업 흐름 상태입니다.", recentUpdates: "최근 수정 이력", recentUpdatesDescription: "최근 수정 순서로 작업 항목을 확인합니다.", assignee: "담당자", lastUpdated: "최근수정", noRecentUpdates: "최근 수정 이력이 없습니다.", bottlenecks: "병목 항목", bottlenecksDescription: "잠금, 검토 지연, 차단 항목을 우선 모읍니다.", lock: "잠금", none: "없음", noBottlenecks: "현재 병목 항목이 없습니다.", assigneeWorkload: "담당자별 작업량", assigneeWorkloadDescription: "현재 협업 배분 상태입니다.", loading: "운영 현황을 불러오는 중입니다.", selectedBot: "선택 봇",
  },
  en: {
    statuses: { todo: "To do", in_progress: "In progress", review: "Pending review", approved: "Approved", blocked: "Blocked" },
    roles: { owner: "Owner", system_admin: "System administrator", group_admin: "Group administrator", builder: "Builder", reviewer: "Reviewer", operator: "Operator", viewer: "Viewer" },
    unspecified: "Unspecified", count: "{count}", botLoadFailed: "Failed to load the bot list.", dashboardLoadFailed: "Failed to load the operations dashboard.", title: "Operations Dashboard", subtitle: "Review API, channel, bot status, and alerts for operations.", refresh: "Refresh", myTasks: "My tasks", reviewQueue: "Pending review", approvalRequired: "Approval required", lockedItems: "Locked", totalTasks: "All tasks", groupProgress: "Progress by group", groupProgressDescription: "Items in progress by group", botProgress: "Progress by bot", botProgressDescription: "Items in progress by bot", roleTasks: "Tasks by role", roleTasksDescription: "Accumulated items by role.", taskStatus: "Task status", taskStatusDescription: "Overall workflow status.", recentUpdates: "Recent updates", recentUpdatesDescription: "Items ordered by latest update.", assignee: "Assignee", lastUpdated: "Last updated", noRecentUpdates: "No recent updates.", bottlenecks: "Bottlenecks", bottlenecksDescription: "Prioritizes locked, delayed-review, and blocked items.", lock: "Lock", none: "None", noBottlenecks: "There are no current bottlenecks.", assigneeWorkload: "Workload by assignee", assigneeWorkloadDescription: "Current collaboration allocation.", loading: "Loading operations status.", selectedBot: "Selected bot",
  },
  "zh-CN": {
    statuses: { todo: "待办", in_progress: "进行中", review: "待审核", approved: "已批准", blocked: "已阻止" },
    roles: { owner: "所有者", system_admin: "系统管理员", group_admin: "组管理员", builder: "制作者", reviewer: "审核者", operator: "运营者", viewer: "查看者" },
    unspecified: "未指定", count: "{count}项", botLoadFailed: "无法加载机器人列表。", dashboardLoadFailed: "无法加载运行仪表板。", title: "运行仪表板", subtitle: "查看运行所需的API、渠道、机器人状态和提醒。", refresh: "刷新", myTasks: "我的任务", reviewQueue: "待审核", approvalRequired: "需要批准", lockedItems: "锁定状态", totalTasks: "全部任务", groupProgress: "按组进度", groupProgressDescription: "按组统计进行中的项目", botProgress: "按机器人进度", botProgressDescription: "按机器人统计进行中的项目", roleTasks: "按角色任务", roleTasksDescription: "按角色累计的项目数。", taskStatus: "任务状态", taskStatusDescription: "整体工作流状态。", recentUpdates: "最近修改", recentUpdatesDescription: "按最近修改顺序查看项目。", assignee: "负责人", lastUpdated: "最近修改", noRecentUpdates: "没有最近修改记录。", bottlenecks: "瓶颈项目", bottlenecksDescription: "优先显示锁定、审核延迟和阻止项目。", lock: "锁定", none: "无", noBottlenecks: "当前没有瓶颈项目。", assigneeWorkload: "按负责人工作量", assigneeWorkloadDescription: "当前协作分配状态。", loading: "正在加载运行状态。", selectedBot: "所选机器人",
  },
  ja: {
    statuses: { todo: "未着手", in_progress: "進行中", review: "レビュー待ち", approved: "承認済み", blocked: "ブロック" },
    roles: { owner: "所有者", system_admin: "システム管理者", group_admin: "グループ管理者", builder: "作成者", reviewer: "レビュー担当", operator: "運用者", viewer: "閲覧者" },
    unspecified: "未指定", count: "{count}件", botLoadFailed: "ボット一覧を読み込めませんでした。", dashboardLoadFailed: "運用ダッシュボードを読み込めませんでした。", title: "運用ダッシュボード", subtitle: "運用基準でAPI、チャネル、ボット状態、アラートを確認します。", refresh: "更新", myTasks: "自分の作業", reviewQueue: "レビュー待ち", approvalRequired: "承認が必要", lockedItems: "ロック状態", totalTasks: "全作業", groupProgress: "グループ別進捗", groupProgressDescription: "グループ基準の進行件数", botProgress: "ボット別進捗", botProgressDescription: "ボット単位の進行件数", roleTasks: "権限別タスク", roleTasksDescription: "役割基準の累積項目数です。", taskStatus: "作業状態", taskStatusDescription: "作業フロー全体の状態です。", recentUpdates: "最近の変更履歴", recentUpdatesDescription: "最近の変更順に項目を確認します。", assignee: "担当者", lastUpdated: "最終更新", noRecentUpdates: "最近の変更履歴はありません。", bottlenecks: "ボトルネック", bottlenecksDescription: "ロック、レビュー遅延、ブロック項目を優先表示します。", lock: "ロック", none: "なし", noBottlenecks: "現在ボトルネックはありません。", assigneeWorkload: "担当者別作業量", assigneeWorkloadDescription: "現在の共同作業配分です。", loading: "運用状況を読み込み中です。", selectedBot: "選択ボット",
  },
  vi: {
    statuses: { todo: "Cần làm", in_progress: "Đang thực hiện", review: "Chờ duyệt", approved: "Đã duyệt", blocked: "Bị chặn" },
    roles: { owner: "Chủ sở hữu", system_admin: "Quản trị hệ thống", group_admin: "Quản trị nhóm", builder: "Người tạo", reviewer: "Người duyệt", operator: "Người vận hành", viewer: "Người xem" },
    unspecified: "Chưa chỉ định", count: "{count} mục", botLoadFailed: "Không thể tải danh sách bot.", dashboardLoadFailed: "Không thể tải bảng điều khiển vận hành.", title: "Bảng điều khiển vận hành", subtitle: "Kiểm tra API, kênh, trạng thái bot và cảnh báo vận hành.", refresh: "Làm mới", myTasks: "Công việc của tôi", reviewQueue: "Chờ duyệt", approvalRequired: "Cần phê duyệt", lockedItems: "Đang khóa", totalTasks: "Tất cả công việc", groupProgress: "Tiến độ theo nhóm", groupProgressDescription: "Số công việc theo nhóm", botProgress: "Tiến độ theo bot", botProgressDescription: "Số công việc theo bot", roleTasks: "Công việc theo vai trò", roleTasksDescription: "Số mục tích lũy theo vai trò.", taskStatus: "Trạng thái công việc", taskStatusDescription: "Trạng thái toàn bộ luồng công việc.", recentUpdates: "Cập nhật gần đây", recentUpdatesDescription: "Xem mục theo thứ tự cập nhật gần nhất.", assignee: "Người phụ trách", lastUpdated: "Cập nhật cuối", noRecentUpdates: "Không có cập nhật gần đây.", bottlenecks: "Điểm nghẽn", bottlenecksDescription: "Ưu tiên mục bị khóa, chậm duyệt và bị chặn.", lock: "Khóa", none: "Không", noBottlenecks: "Hiện không có điểm nghẽn.", assigneeWorkload: "Khối lượng theo người phụ trách", assigneeWorkloadDescription: "Phân bổ cộng tác hiện tại.", loading: "Đang tải trạng thái vận hành.", selectedBot: "Bot đã chọn",
  },
  fr: {
    statuses: { todo: "À faire", in_progress: "En cours", review: "En attente de révision", approved: "Approuvé", blocked: "Bloqué" },
    roles: { owner: "Propriétaire", system_admin: "Administrateur système", group_admin: "Administrateur de groupe", builder: "Créateur", reviewer: "Réviseur", operator: "Opérateur", viewer: "Lecteur" },
    unspecified: "Non attribué", count: "{count} éléments", botLoadFailed: "Impossible de charger la liste des bots.", dashboardLoadFailed: "Impossible de charger le tableau de bord d’exploitation.", title: "Tableau de bord d’exploitation", subtitle: "Consultez les API, canaux, états des bots et alertes d’exploitation.", refresh: "Actualiser", myTasks: "Mes tâches", reviewQueue: "En attente de révision", approvalRequired: "Approbation requise", lockedItems: "Verrouillé", totalTasks: "Toutes les tâches", groupProgress: "Progression par groupe", groupProgressDescription: "Éléments en cours par groupe", botProgress: "Progression par bot", botProgressDescription: "Éléments en cours par bot", roleTasks: "Tâches par rôle", roleTasksDescription: "Nombre cumulé d’éléments par rôle.", taskStatus: "État des tâches", taskStatusDescription: "État global du flux de travail.", recentUpdates: "Modifications récentes", recentUpdatesDescription: "Éléments classés par modification récente.", assignee: "Responsable", lastUpdated: "Dernière modification", noRecentUpdates: "Aucune modification récente.", bottlenecks: "Goulots d’étranglement", bottlenecksDescription: "Priorise les éléments verrouillés, retardés ou bloqués.", lock: "Verrou", none: "Aucun", noBottlenecks: "Aucun goulot d’étranglement actuel.", assigneeWorkload: "Charge par responsable", assigneeWorkloadDescription: "Répartition actuelle de la collaboration.", loading: "Chargement de l’état d’exploitation.", selectedBot: "Bot sélectionné",
  },
  de: {
    statuses: { todo: "Zu erledigen", in_progress: "In Bearbeitung", review: "Prüfung ausstehend", approved: "Genehmigt", blocked: "Blockiert" },
    roles: { owner: "Eigentümer", system_admin: "Systemadministrator", group_admin: "Gruppenadministrator", builder: "Ersteller", reviewer: "Prüfer", operator: "Betreiber", viewer: "Betrachter" },
    unspecified: "Nicht zugewiesen", count: "{count} Einträge", botLoadFailed: "Die Bot-Liste konnte nicht geladen werden.", dashboardLoadFailed: "Das Betriebsdashboard konnte nicht geladen werden.", title: "Betriebsdashboard", subtitle: "Prüfen Sie API-, Kanal- und Bot-Status sowie Betriebswarnungen.", refresh: "Aktualisieren", myTasks: "Meine Aufgaben", reviewQueue: "Prüfung ausstehend", approvalRequired: "Genehmigung erforderlich", lockedItems: "Gesperrt", totalTasks: "Alle Aufgaben", groupProgress: "Fortschritt nach Gruppe", groupProgressDescription: "Laufende Einträge nach Gruppe", botProgress: "Fortschritt nach Bot", botProgressDescription: "Laufende Einträge nach Bot", roleTasks: "Aufgaben nach Rolle", roleTasksDescription: "Kumulierte Einträge nach Rolle.", taskStatus: "Aufgabenstatus", taskStatusDescription: "Status des gesamten Arbeitsablaufs.", recentUpdates: "Letzte Änderungen", recentUpdatesDescription: "Einträge nach der letzten Änderung sortiert.", assignee: "Zuständig", lastUpdated: "Zuletzt geändert", noRecentUpdates: "Keine letzten Änderungen.", bottlenecks: "Engpässe", bottlenecksDescription: "Priorisiert gesperrte, verzögerte und blockierte Einträge.", lock: "Sperre", none: "Keine", noBottlenecks: "Derzeit keine Engpässe.", assigneeWorkload: "Arbeitslast nach Zuständigem", assigneeWorkloadDescription: "Aktuelle Verteilung der Zusammenarbeit.", loading: "Betriebsstatus wird geladen.", selectedBot: "Ausgewählter Bot",
  },
} satisfies Record<SupportedLanguage, StudioOperationsDashboardCatalog>;

export function formatStudioOperationsDashboardText(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}