import type { SupportedLanguage } from "@/lib/language";

type GettingStartedSlide = { title: string; description: string; variant: "design" | "enterprise" | "improve" };

export type StudioRailCatalog = {
  gettingStartedSlides: readonly GettingStartedSlide[];
  defaultServer: string;
  noLicense: string;
  mainMenu: string;
  menu: string;
  closeMenu: string;
  nextIntroduction: string;
  introductionSelection: string;
  introductionAt: string;
  experienceMode: string;
  closeUserMenu: string;
  noPermission: string;
};

export const STUDIO_RAIL_CATALOGS = {
  ko: {
    gettingStartedSlides: [
      { title: "쉽고 빠르게 AI 챗봇을 만들 수 있습니다.", description: "캔버스에서 대화 흐름을 설계하고 즉시 테스트하며 누구나 쉽고 빠르게 챗봇을 만들 수 있습니다.", variant: "design" },
      { title: "Enterprise 전용 챗봇 구축에 최적화되어 있습니다.", description: "Bot Station과 API Store로 사내 시스템 및 RPA 솔루션을 연계하고 다양한 메신저·보이스 채널의 업무를 자동화할 수 있습니다.", variant: "enterprise" },
      { title: "운영 데이터를 바탕으로 챗봇을 지속 개선할 수 있습니다.", description: "분석·평가·대화 이력을 확인하고 실패 발화를 학습 데이터로 반영하여 챗봇 품질을 반복적으로 개선할 수 있습니다.", variant: "improve" },
    ],
    defaultServer: "기본 서버", noLicense: "라이선스 정보 없음", mainMenu: "스튜디오 주요 메뉴", menu: "메뉴", closeMenu: "메뉴 닫기",
    nextIntroduction: "다음 소개 보기", introductionSelection: "소개 슬라이드 선택", introductionAt: "{index}번째 소개 보기",
    experienceMode: "Getting Started 체험 방법", closeUserMenu: "사용자 메뉴 닫기", noPermission: "권한 없음",
  },
  en: {
    gettingStartedSlides: [
      { title: "Build AI chatbots quickly and easily.", description: "Design conversation flows on an intuitive canvas and test them immediately as you build.", variant: "design" },
      { title: "Optimized for enterprise chatbot delivery.", description: "Connect internal systems and RPA through Bot Station and API Store, then automate work across messenger and voice channels.", variant: "enterprise" },
      { title: "Continuously improve bots with operational data.", description: "Review analytics, evaluations, and conversations, then feed failed utterances back into training data.", variant: "improve" },
    ],
    defaultServer: "Default Server", noLicense: "No license information", mainMenu: "Studio main menu", menu: "Menu", closeMenu: "Close menu",
    nextIntroduction: "View next introduction", introductionSelection: "Select introduction slide", introductionAt: "View introduction {index}",
    experienceMode: "Getting Started experience mode", closeUserMenu: "Close user menu", noPermission: "No permissions",
  },
  "zh-CN": {
    gettingStartedSlides: [
      { title: "轻松快速地创建 AI 机器人。", description: "在直观的画布上设计对话流程，并在构建过程中立即测试。", variant: "design" },
      { title: "针对企业机器人构建进行了优化。", description: "通过 Bot Station 和 API Store 连接内部系统及 RPA，并自动化消息和语音渠道业务。", variant: "enterprise" },
      { title: "利用运营数据持续改进机器人。", description: "查看分析、评估和对话历史，并将失败话语重新用于训练。", variant: "improve" },
    ],
    defaultServer: "默认服务器", noLicense: "无许可证信息", mainMenu: "Studio 主菜单", menu: "菜单", closeMenu: "关闭菜单",
    nextIntroduction: "查看下一个介绍", introductionSelection: "选择介绍幻灯片", introductionAt: "查看第 {index} 个介绍",
    experienceMode: "Getting Started 体验方式", closeUserMenu: "关闭用户菜单", noPermission: "无权限",
  },
  ja: {
    gettingStartedSlides: [
      { title: "AIチャットボットを簡単かつ迅速に作成できます。", description: "直感的なキャンバスで対話フローを設計し、作成中にすぐテストできます。", variant: "design" },
      { title: "エンタープライズ向けボット構築に最適です。", description: "Bot StationとAPI Storeで社内システムやRPAを連携し、メッセンジャー・音声業務を自動化できます。", variant: "enterprise" },
      { title: "運用データを基に継続的に改善できます。", description: "分析・評価・対話履歴を確認し、失敗発話を学習データに反映できます。", variant: "improve" },
    ],
    defaultServer: "デフォルトサーバー", noLicense: "ライセンス情報なし", mainMenu: "Studioメインメニュー", menu: "メニュー", closeMenu: "メニューを閉じる",
    nextIntroduction: "次の紹介を見る", introductionSelection: "紹介スライド選択", introductionAt: "紹介 {index} を見る",
    experienceMode: "Getting Started体験方法", closeUserMenu: "ユーザーメニューを閉じる", noPermission: "権限なし",
  },
  vi: {
    gettingStartedSlides: [
      { title: "Tạo chatbot AI nhanh chóng và dễ dàng.", description: "Thiết kế luồng hội thoại trên canvas trực quan và kiểm thử ngay trong khi xây dựng.", variant: "design" },
      { title: "Tối ưu cho chatbot doanh nghiệp.", description: "Kết nối hệ thống nội bộ và RPA qua Bot Station, API Store, đồng thời tự động hóa kênh nhắn tin và thoại.", variant: "enterprise" },
      { title: "Liên tục cải thiện bot bằng dữ liệu vận hành.", description: "Xem phân tích, đánh giá, lịch sử hội thoại và đưa câu nói lỗi trở lại dữ liệu huấn luyện.", variant: "improve" },
    ],
    defaultServer: "Máy chủ mặc định", noLicense: "Không có thông tin giấy phép", mainMenu: "Menu chính Studio", menu: "Menu", closeMenu: "Đóng menu",
    nextIntroduction: "Xem giới thiệu tiếp theo", introductionSelection: "Chọn trang giới thiệu", introductionAt: "Xem giới thiệu {index}",
    experienceMode: "Cách trải nghiệm Getting Started", closeUserMenu: "Đóng menu người dùng", noPermission: "Không có quyền",
  },
  fr: {
    gettingStartedSlides: [
      { title: "Créez facilement et rapidement des chatbots IA.", description: "Concevez les flux sur un canevas intuitif et testez-les immédiatement pendant la création.", variant: "design" },
      { title: "Optimisé pour les chatbots d’entreprise.", description: "Connectez les systèmes internes et la RPA via Bot Station et API Store, puis automatisez les canaux de messagerie et vocaux.", variant: "enterprise" },
      { title: "Améliorez continuellement les bots avec les données d’exploitation.", description: "Consultez analyses, évaluations et conversations, puis réintégrez les échecs aux données d’entraînement.", variant: "improve" },
    ],
    defaultServer: "Serveur par défaut", noLicense: "Aucune information de licence", mainMenu: "Menu principal Studio", menu: "Menu", closeMenu: "Fermer le menu",
    nextIntroduction: "Voir la présentation suivante", introductionSelection: "Choisir une présentation", introductionAt: "Voir la présentation {index}",
    experienceMode: "Mode de découverte Getting Started", closeUserMenu: "Fermer le menu utilisateur", noPermission: "Aucune autorisation",
  },
  de: {
    gettingStartedSlides: [
      { title: "KI-Chatbots schnell und einfach erstellen.", description: "Dialogabläufe auf einer intuitiven Arbeitsfläche entwerfen und sofort beim Erstellen testen.", variant: "design" },
      { title: "Für Enterprise-Chatbots optimiert.", description: "Interne Systeme und RPA über Bot Station und API Store anbinden und Messenger- sowie Sprachkanäle automatisieren.", variant: "enterprise" },
      { title: "Bots mit Betriebsdaten kontinuierlich verbessern.", description: "Analysen, Bewertungen und Gespräche prüfen und fehlgeschlagene Äußerungen wieder ins Training übernehmen.", variant: "improve" },
    ],
    defaultServer: "Standardserver", noLicense: "Keine Lizenzinformationen", mainMenu: "Studio-Hauptmenü", menu: "Menü", closeMenu: "Menü schließen",
    nextIntroduction: "Nächste Einführung anzeigen", introductionSelection: "Einführungsfolie auswählen", introductionAt: "Einführung {index} anzeigen",
    experienceMode: "Getting-Started-Erlebnis", closeUserMenu: "Benutzermenü schließen", noPermission: "Keine Berechtigung",
  },
} satisfies Record<SupportedLanguage, StudioRailCatalog>;

export function formatStudioRailText(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
