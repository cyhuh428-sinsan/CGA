import type { SupportedLanguage } from "@/lib/language";

export type AdminGroupsCatalog = {
  title:string; searchPlaceholder:string; loading:string; total:string; columns:string[]; create:string;
  goToLogin:string; loginRequired:string; loadFailed:string; statuses:Record<string,string>;
};

export const ADMIN_GROUPS_CATALOGS = {
  ko:{title:"그룹 관리",searchPlaceholder:"그룹 아이디 또는 그룹 이름을 검색하세요.",loading:"불러오는 중",total:"전체 {count}건",columns:["그룹 아이디","그룹 이름","사용여부","생성자","최종수정자","최종수정일시"],create:"+ 그룹 생성",goToLogin:"로그인으로 이동",loginRequired:"로그인이 필요합니다.",loadFailed:"그룹 목록을 불러오지 못했습니다.",statuses:{active:"사용",inactive:"미사용"}},
  en:{title:"Group Management",searchPlaceholder:"Search by group ID or name.",loading:"Loading",total:"Total {count}",columns:["Group ID","Group Name","Status","Created By","Updated By","Updated At"],create:"+ Create Group",goToLogin:"Go to login",loginRequired:"Login is required.",loadFailed:"Could not load the group list.",statuses:{active:"Active",inactive:"Inactive"}},
  "zh-CN":{title:"组管理",searchPlaceholder:"按组ID或组名搜索。",loading:"加载中",total:"共{count}项",columns:["组ID","组名","状态","创建者","最后修改者","最后修改时间"],create:"+ 创建组",goToLogin:"前往登录",loginRequired:"需要登录。",loadFailed:"无法加载组列表。",statuses:{active:"启用",inactive:"停用"}},
  ja:{title:"グループ管理",searchPlaceholder:"グループIDまたは名前で検索します。",loading:"読み込み中",total:"全{count}件",columns:["グループID","グループ名","使用状態","作成者","最終更新者","最終更新日時"],create:"+ グループ作成",goToLogin:"ログインへ",loginRequired:"ログインが必要です。",loadFailed:"グループ一覧を取得できませんでした。",statuses:{active:"使用",inactive:"未使用"}},
  vi:{title:"Quản lý nhóm",searchPlaceholder:"Tìm theo ID hoặc tên nhóm.",loading:"Đang tải",total:"Tổng {count}",columns:["ID nhóm","Tên nhóm","Trạng thái","Người tạo","Người cập nhật","Thời gian cập nhật"],create:"+ Tạo nhóm",goToLogin:"Đến đăng nhập",loginRequired:"Cần đăng nhập.",loadFailed:"Không thể tải danh sách nhóm.",statuses:{active:"Hoạt động",inactive:"Không hoạt động"}},
  fr:{title:"Gestion des groupes",searchPlaceholder:"Rechercher par identifiant ou nom de groupe.",loading:"Chargement",total:"Total {count}",columns:["ID du groupe","Nom du groupe","État","Créateur","Dernière modification par","Modifié le"],create:"+ Créer un groupe",goToLogin:"Aller à la connexion",loginRequired:"Connexion requise.",loadFailed:"Impossible de charger la liste des groupes.",statuses:{active:"Actif",inactive:"Inactif"}},
  de:{title:"Gruppenverwaltung",searchPlaceholder:"Nach Gruppen-ID oder Name suchen.",loading:"Wird geladen",total:"Gesamt {count}",columns:["Gruppen-ID","Gruppenname","Status","Ersteller","Zuletzt geändert von","Geändert am"],create:"+ Gruppe erstellen",goToLogin:"Zur Anmeldung",loginRequired:"Anmeldung erforderlich.",loadFailed:"Gruppenliste konnte nicht geladen werden.",statuses:{active:"Aktiv",inactive:"Inaktiv"}},
} satisfies Record<SupportedLanguage, AdminGroupsCatalog>;

export function formatAdminGroupsText(template:string, values:Record<string,string|number>) {
  return template.replace(/\{(\w+)\}/g, (_, key:string) => String(values[key] ?? ""));
}
