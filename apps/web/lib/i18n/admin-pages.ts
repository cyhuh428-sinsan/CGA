import type { SupportedLanguage } from "@/lib/language";

export type AdminPageCopy = {
  title: string;
  searchPlaceholder: string;
  columns: string[];
  detail: string;
  close: string;
  empty: string;
};

export type AdminPageCatalog = {
  apiCallHistory: AdminPageCopy;
  botStatus: AdminPageCopy;
  loginHistory: AdminPageCopy;
  trainingHistory: AdminPageCopy;
  intentFeedback: AdminPageCopy;
};

export const ADMIN_PAGE_CATALOGS = {
  ko: {
    apiCallHistory: { title: "API 호출 이력 조회", searchPlaceholder: "API 이름 또는 의도명을 검색하세요.", columns: ["", "Method", "Filters", "API 이름", "API 유형", "URL", "전송방식", "채널", "그룹", "봇", "버전", "의도명", "응답코드", "소요(ms)", "사용자", "시간", "상세"], detail: "상세", close: "닫기", empty: "API 호출 이력이 없습니다." },
    botStatus: { title: "봇 현황 조회", searchPlaceholder: "봇 이름을 검색하세요.", columns: ["", "그룹", "봇", "언어", "NLU", "버전 수", "생성자", "생성일시"], detail: "상세", close: "닫기", empty: "봇이 없습니다." },
    loginHistory: { title: "로그인 이력", searchPlaceholder: "사용자 계정 또는 사용자 이름을 검색하세요.", columns: ["사용자 계정", "사용자 이름", "그룹", "역할", "접속한 IP", "로그인 시간", "로그아웃 시간"], detail: "상세", close: "닫기", empty: "로그인 이력이 없습니다." },
    trainingHistory: { title: "학습 이력 조회", searchPlaceholder: "봇 이름을 검색하세요.", columns: ["", "그룹", "봇", "버전", "학습 엔진", "학습상태", "사용자", "학습 시작 시간", "학습 완료 시간", "상세"], detail: "상세", close: "닫기", empty: "학습 이력이 없습니다." },
    intentFeedback: { title: "의도별 피드백 조회", searchPlaceholder: "의도명, 봇명, 발화를 검색하세요.", columns: ["", "그룹", "봇", "버전", "채널", "의도명", "평균 점수", "후보 건수", "진단"], detail: "상세", close: "닫기", empty: "미분류 또는 낮은 점수로 수집된 의도 피드백 후보가 없습니다." },
  },
  en: {
    apiCallHistory: { title: "API Call History", searchPlaceholder: "Search by API or intent name.", columns: ["", "Method", "Filters", "API Name", "API Type", "URL", "Transfer", "Channel", "Group", "Bot", "Version", "Intent", "Response Code", "Elapsed (ms)", "User", "Time", "Details"], detail: "Details", close: "Close", empty: "No API call history." },
    botStatus: { title: "Bot Status", searchPlaceholder: "Search by bot name.", columns: ["", "Group", "Bot", "Language", "NLU", "Versions", "Created By", "Created At"], detail: "Details", close: "Close", empty: "No bots." },
    loginHistory: { title: "Login History", searchPlaceholder: "Search by account or user name.", columns: ["Account", "User Name", "Group", "Role", "IP Address", "Login Time", "Logout Time"], detail: "Details", close: "Close", empty: "No login history." },
    trainingHistory: { title: "Training History", searchPlaceholder: "Search by bot name.", columns: ["", "Group", "Bot", "Version", "Training Engine", "Status", "User", "Started At", "Completed At", "Details"], detail: "Details", close: "Close", empty: "No training history." },
    intentFeedback: { title: "Intent Feedback", searchPlaceholder: "Search by intent, bot, or utterance.", columns: ["", "Group", "Bot", "Version", "Channel", "Intent", "Average Score", "Candidates", "Diagnosis"], detail: "Details", close: "Close", empty: "No unclassified or low-score intent feedback candidates." },
  },
  "zh-CN": {
    apiCallHistory: { title: "API 调用历史", searchPlaceholder: "按 API 名称或意图名称搜索。", columns: ["", "方法", "筛选", "API 名称", "API 类型", "URL", "传输方式", "渠道", "组", "机器人", "版本", "意图", "响应代码", "耗时(ms)", "用户", "时间", "详情"], detail: "详情", close: "关闭", empty: "没有 API 调用历史。" },
    botStatus: { title: "机器人状态", searchPlaceholder: "按机器人名称搜索。", columns: ["", "组", "机器人", "语言", "NLU", "版本数", "创建者", "创建时间"], detail: "详情", close: "关闭", empty: "没有机器人。" },
    loginHistory: { title: "登录历史", searchPlaceholder: "按账户或用户名搜索。", columns: ["用户账户", "用户名", "组", "角色", "IP 地址", "登录时间", "退出时间"], detail: "详情", close: "关闭", empty: "没有登录历史。" },
    trainingHistory: { title: "训练历史", searchPlaceholder: "按机器人名称搜索。", columns: ["", "组", "机器人", "版本", "训练引擎", "状态", "用户", "开始时间", "完成时间", "详情"], detail: "详情", close: "关闭", empty: "没有训练历史。" },
    intentFeedback: { title: "意图反馈", searchPlaceholder: "按意图、机器人或话语搜索。", columns: ["", "组", "机器人", "版本", "渠道", "意图", "平均分", "候选数", "诊断"], detail: "详情", close: "关闭", empty: "没有未分类或低分意图反馈候选。" },
  },
  ja: {
    apiCallHistory: { title: "API 呼び出し履歴", searchPlaceholder: "API名またはインテント名で検索します。", columns: ["", "Method", "Filters", "API名", "API種別", "URL", "転送方式", "チャネル", "グループ", "ボット", "バージョン", "インテント", "応答コード", "所要(ms)", "ユーザー", "時刻", "詳細"], detail: "詳細", close: "閉じる", empty: "API 呼び出し履歴がありません。" },
    botStatus: { title: "ボット状況", searchPlaceholder: "ボット名で検索します。", columns: ["", "グループ", "ボット", "言語", "NLU", "バージョン数", "作成者", "作成日時"], detail: "詳細", close: "閉じる", empty: "ボットがありません。" },
    loginHistory: { title: "ログイン履歴", searchPlaceholder: "アカウントまたはユーザー名で検索します。", columns: ["ユーザーアカウント", "ユーザー名", "グループ", "ロール", "IPアドレス", "ログイン時刻", "ログアウト時刻"], detail: "詳細", close: "閉じる", empty: "ログイン履歴がありません。" },
    trainingHistory: { title: "学習履歴", searchPlaceholder: "ボット名で検索します。", columns: ["", "グループ", "ボット", "バージョン", "学習エンジン", "状態", "ユーザー", "開始時刻", "完了時刻", "詳細"], detail: "詳細", close: "閉じる", empty: "学習履歴がありません。" },
    intentFeedback: { title: "インテント別フィードバック", searchPlaceholder: "インテント、ボット、発話で検索します。", columns: ["", "グループ", "ボット", "バージョン", "チャネル", "インテント", "平均スコア", "候補数", "診断"], detail: "詳細", close: "閉じる", empty: "未分類または低スコアの候補がありません。" },
  },
  vi: {
    apiCallHistory: { title: "Lịch sử gọi API", searchPlaceholder: "Tìm theo tên API hoặc ý định.", columns: ["", "Phương thức", "Bộ lọc", "Tên API", "Loại API", "URL", "Truyền", "Kênh", "Nhóm", "Bot", "Phiên bản", "Ý định", "Mã phản hồi", "Thời gian(ms)", "Người dùng", "Thời điểm", "Chi tiết"], detail: "Chi tiết", close: "Đóng", empty: "Không có lịch sử gọi API." },
    botStatus: { title: "Trạng thái bot", searchPlaceholder: "Tìm theo tên bot.", columns: ["", "Nhóm", "Bot", "Ngôn ngữ", "NLU", "Số phiên bản", "Người tạo", "Ngày tạo"], detail: "Chi tiết", close: "Đóng", empty: "Không có bot." },
    loginHistory: { title: "Lịch sử đăng nhập", searchPlaceholder: "Tìm theo tài khoản hoặc tên người dùng.", columns: ["Tài khoản", "Tên người dùng", "Nhóm", "Vai trò", "Địa chỉ IP", "Giờ đăng nhập", "Giờ đăng xuất"], detail: "Chi tiết", close: "Đóng", empty: "Không có lịch sử đăng nhập." },
    trainingHistory: { title: "Lịch sử huấn luyện", searchPlaceholder: "Tìm theo tên bot.", columns: ["", "Nhóm", "Bot", "Phiên bản", "Công cụ", "Trạng thái", "Người dùng", "Bắt đầu", "Hoàn tất", "Chi tiết"], detail: "Chi tiết", close: "Đóng", empty: "Không có lịch sử huấn luyện." },
    intentFeedback: { title: "Phản hồi ý định", searchPlaceholder: "Tìm theo ý định, bot hoặc câu nói.", columns: ["", "Nhóm", "Bot", "Phiên bản", "Kênh", "Ý định", "Điểm trung bình", "Ứng viên", "Chẩn đoán"], detail: "Chi tiết", close: "Đóng", empty: "Không có ứng viên chưa phân loại hoặc điểm thấp." },
  },
  fr: {
    apiCallHistory: { title: "Historique des appels API", searchPlaceholder: "Rechercher par API ou intention.", columns: ["", "Méthode", "Filtres", "Nom API", "Type API", "URL", "Transfert", "Canal", "Groupe", "Bot", "Version", "Intention", "Code réponse", "Durée(ms)", "Utilisateur", "Heure", "Détails"], detail: "Détails", close: "Fermer", empty: "Aucun historique d’appel API." },
    botStatus: { title: "État des bots", searchPlaceholder: "Rechercher par nom de bot.", columns: ["", "Groupe", "Bot", "Langue", "NLU", "Versions", "Créateur", "Créé le"], detail: "Détails", close: "Fermer", empty: "Aucun bot." },
    loginHistory: { title: "Historique des connexions", searchPlaceholder: "Rechercher par compte ou nom.", columns: ["Compte", "Nom", "Groupe", "Rôle", "Adresse IP", "Connexion", "Déconnexion"], detail: "Détails", close: "Fermer", empty: "Aucun historique de connexion." },
    trainingHistory: { title: "Historique d’entraînement", searchPlaceholder: "Rechercher par nom de bot.", columns: ["", "Groupe", "Bot", "Version", "Moteur", "État", "Utilisateur", "Début", "Fin", "Détails"], detail: "Détails", close: "Fermer", empty: "Aucun historique d’entraînement." },
    intentFeedback: { title: "Retours par intention", searchPlaceholder: "Rechercher par intention, bot ou énoncé.", columns: ["", "Groupe", "Bot", "Version", "Canal", "Intention", "Score moyen", "Candidats", "Diagnostic"], detail: "Détails", close: "Fermer", empty: "Aucun candidat non classé ou à faible score." },
  },
  de: {
    apiCallHistory: { title: "API-Aufrufverlauf", searchPlaceholder: "Nach API- oder Intent-Namen suchen.", columns: ["", "Methode", "Filter", "API-Name", "API-Typ", "URL", "Übertragung", "Kanal", "Gruppe", "Bot", "Version", "Intent", "Antwortcode", "Dauer(ms)", "Benutzer", "Zeit", "Details"], detail: "Details", close: "Schließen", empty: "Kein API-Aufrufverlauf." },
    botStatus: { title: "Bot-Status", searchPlaceholder: "Nach Bot-Namen suchen.", columns: ["", "Gruppe", "Bot", "Sprache", "NLU", "Versionen", "Ersteller", "Erstellt am"], detail: "Details", close: "Schließen", empty: "Keine Bots." },
    loginHistory: { title: "Anmeldeverlauf", searchPlaceholder: "Nach Konto oder Benutzername suchen.", columns: ["Konto", "Benutzername", "Gruppe", "Rolle", "IP-Adresse", "Anmeldezeit", "Abmeldezeit"], detail: "Details", close: "Schließen", empty: "Kein Anmeldeverlauf." },
    trainingHistory: { title: "Trainingsverlauf", searchPlaceholder: "Nach Bot-Namen suchen.", columns: ["", "Gruppe", "Bot", "Version", "Engine", "Status", "Benutzer", "Beginn", "Ende", "Details"], detail: "Details", close: "Schließen", empty: "Kein Trainingsverlauf." },
    intentFeedback: { title: "Intent-Feedback", searchPlaceholder: "Nach Intent, Bot oder Äußerung suchen.", columns: ["", "Gruppe", "Bot", "Version", "Kanal", "Intent", "Durchschnitt", "Kandidaten", "Diagnose"], detail: "Details", close: "Schließen", empty: "Keine unklassifizierten oder niedrig bewerteten Kandidaten." },
  },
} satisfies Record<SupportedLanguage, AdminPageCatalog>;
