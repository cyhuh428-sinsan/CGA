import type { SupportedLanguage } from "@/lib/language";
import { STUDIO_PAGE_EN_ADDITIONAL } from "@/lib/i18n/studio-pages-extra";
import { STUDIO_PAGE_NATIVE_ADDITIONAL } from "@/lib/i18n/studio-pages-native-extra";
import { STUDIO_PAGE_COMPLETE_NATIVE } from "@/lib/i18n/studio-pages-complete-native";

export type StudioPageCatalog = { labels: Record<string, string> };

const enLabels: Record<string, string> = {
  ...STUDIO_PAGE_EN_ADDITIONAL,
  "로그인 정보 없음":"No sign-in information","세션이 만료되었거나 로그인이 필요합니다.":"The session has expired or sign-in is required.","로그인":"Sign in","권한 없음":"No role","내 정보":"My profile","비밀번호 변경":"Change password","로그아웃 중...":"Signing out...","로그아웃":"Sign out",
  "파일 업로드":"File upload","양식 다운로드":"Download template","유의사항":"Important notes","예시":"Example","파일을 선택하세요":"Select a file","파일 선택":"Choose file","업로드 결과":"Upload result","건":"items",
  "화면을 불러오는 중입니다.":"Loading the page.","실제 봇과 버전 정보를 확인하는 중입니다.":"Checking the bot and version information.","필터":"Filter","시뮬레이터 열기":"Open simulator",
  "우선 봇 설정을 저장하지 못했습니다.":"Could not save the favorite bot setting.","우선 봇 해제":"Remove favorite bot","우선 봇 설정":"Set favorite bot","상세 메뉴":"Details menu","버전 관리":"Version management","버전 선택":"Select version","운영":"Live","미학습":"Untrained","테스트형":"Testing","작성중":"Draft","비활성":"Inactive",
  "봇 목록을 불러오는 중입니다...":"Loading bots...","봇 목록을 불러오지 못했습니다.":"Could not load the bot list.","+ 봇/봇 허브 생성":"+ Create bot/Bot Hub","아직 생성된 봇이 없네요.":"No bots have been created yet.","아직 생성된 봇 허브가 없네요.":"No Bot Hubs have been created yet.","텍스트형":"Text","보이스형":"Voice","봇 허브":"Bot Hub",
  "대화 설계":"Conversation design","대화 이력":"Conversation history","의도명 또는 표시명을 검색하세요.":"Search by intent or display name.","사용자 발화 또는 의도명을 검색하세요.":"Search by user utterance or intent.","전체 6":"Total 6","전체 12":"Total 12","10개씩 보기":"10 per page","20개씩 보기":"20 per page","의도/모듈명":"Intent/Module name","표시명":"Display name","학습문장":"Training utterances","최종수정일시":"Last modified","열기":"Open","발화일시":"Utterance time","사용자 발화":"User utterance","실행 결과":"Execution result","상세":"Details","보기":"View","응답완료":"Responded","대화 상세":"Conversation details","대화 메시지와 실행 흐름을 검토하는 화면입니다.":"Review conversation messages and the execution flow.","대화 이력 조회하기":"View conversation history","대화 이력 목록":"Conversation history list","메인 화면":"Main screen",
  "기본 설정":"Basic settings","기본 정보":"Basic information","기본 프로필":"Default profile","기본 프로필 사용":"Use default profile","기본값 설정":"Set defaults",
  "고급 설정":"Advanced settings","설정":"Settings","설정정보":"Settings information","메시지 설정":"Message settings","메신저 편의 기능":"Messenger convenience features",
  "닫기":"Close","취소":"Cancel","확인":"Confirm","저장":"Save","삭제":"Delete","사용":"Use","사용 안함":"Do not use","미사용":"Inactive","사용 여부":"Use status","상태":"Status",
  "봇":"Bot","봇 이름":"Bot name","봇 설명":"Bot description","봇 프로필":"Bot profile","봇 ID":"Bot ID","봇 UUID":"Bot UUID","운영버전":"Live version","언어":"Language",
  "봇 삭제하기":"Delete bot","봇을 삭제하면 연결된 버전 정보도 함께 삭제됩니다.":"Deleting the bot also deletes its connected version information.","삭제 후에는 되돌릴 수 없습니다.":"This action cannot be undone.","DELETE 입력":"Enter DELETE",
  "봇 허브 구성":"Bot Hub composition","봇 허브 목록":"Bot Hub list","봇 허브 설정":"Bot Hub settings","봇 허브 재학습":"Bot Hub retraining",
  "봇 허브 재학습 후보 이력":"Bot Hub retraining candidate history","봇 허브 시뮬레이터":"Bot Hub simulator","봇 허브 이름":"Bot Hub name","봇 허브 화면":"Bot Hub screen",
  "봇 허브를 불러오는 중입니다...":"Loading Bot Hub...","봇 허브 재학습 후보를 불러오는 중입니다...":"Loading Bot Hub retraining candidates...",
  "봇 허브 이름을 입력해주세요.":"Enter a Bot Hub name.","봇 허브를 설명할 수 있는 소개 문장을 입력해주세요.":"Enter an introduction that describes the Bot Hub.",
  "소개":"Introduction","허브 구성":"Hub composition","하위 봇":"Child bot","하위 봇 선택":"Select child bot","전체 하위 봇":"All child bots","담긴 봇이 없습니다. 봇 허브 구성을 클릭해 일반 봇을 추가하세요.":"There are no bots in this hub. Select Bot Hub composition to add regular bots.",
  "왼쪽 목록에서 하위 봇을 선택하세요.":"Select a child bot from the list on the left.","추가할 일반 봇이 없습니다.":"There are no regular bots to add.","봇이 연결되지 않았습니다.":"No bot is connected.",
  "룰 설정":"Rule settings","룰 상세 정보":"Rule details","룰 이름":"Rule name","룰 설명":"Rule description","룰 표현식":"Rule expression","룰 이름을 검색하세요.":"Search rule names.","등록된 룰이 없습니다.":"No rules are registered.","+ 룰 추가":"+ Add rule",
  "스몰토크":"Small talk","스몰토크 상세":"Small talk details","스몰토크 이름*":"Small talk name*","스몰토크 이름을 검색하세요.":"Search small talk names.","등록된 스몰토크가 없습니다.":"No small talk is registered.","+ 스몰토크 추가":"+ Add small talk",
  "제외/무시 목록 설정":"Exclude/Ignore list settings","제외/무시 목록 상세":"Exclude/Ignore list details","제외/무시 목록 이름":"Exclude/Ignore list name","제외/무시 텍스트/정규식":"Exclude/Ignore text/regex","등록된 제외/무시 목록이 없습니다.":"No exclude/ignore entries are registered.","+ 제외/무시 목록 추가":"+ Add exclude/ignore entry",
  "정규식 테스트":"Regex test","정규식 확인":"Check regex","테스트할 문장을 입력하세요.":"Enter a sentence to test.","테스트 표현을 입력하세요.":"Enter a test expression.","테스트":"Test","결과":"Result","대상 없음":"No target",
  "첫 인사말":"Initial greeting","사용자의 의도를 이해하지 못한 경우":"When the user's intent is not understood","사용자의 의도를 이해하지 못했을 경우 답변":"Reply when the user's intent is not understood",
  "유사의도/되묻기(2)":"Similar intent / clarification (2)","의도 전환/복귀(3)":"Intent switch / return (3)","기본 메시지(4)":"Default messages (4)","대화 종료(4)":"Conversation end (4)",
  "봇 동작 오류시 안내 메시지":"Bot operation error message","대화가 진행 중인 경우":"When a conversation is in progress","타임아웃 경과 시":"When timeout elapses","Session End 안내 메시지":"Session end message",
  "답변 생성 시스템 프롬프트":"Answer generation system prompt","LLM이 답변을 생성할 때 따라야 할 말투, 형식, 제한사항을 입력하세요.":"Enter the tone, format, and constraints the LLM should follow when generating answers.",
  "사용자 응답 사이 최대 카드 수":"Maximum cards between user responses","실행 제한":"Execution limits","타임아웃 사용":"Use timeout","타임아웃 시간(초)":"Timeout (seconds)",
  "플로팅 버튼":"Floating buttons","플로팅 버튼 상세":"Floating button details","등록된 플로팅 버튼이 없습니다.":"No floating buttons are registered.","+ 플로팅 버튼 추가":"+ Add floating button",
  "추천 의도":"Recommended intents","추천 의도 구성":"Configure recommended intents","구성할 추천 의도":"Recommended intent to configure","구성된 추천 의도가 없습니다.":"No recommended intents are configured.","+ 추천 의도 구성":"+ Configure recommended intent",
  "버튼명":"Button name","버튼 표시명":"Button display name","선택 시 메시지":"Message on selection","순서":"Order","추천 순서":"Recommendation order",
  "모듈 연결":"Module connection","연결할 의도/모듈":"Intent/module to connect","모듈 목록":"Module list","등록된 모듈이 없습니다.":"No modules are registered.","우측 버튼을 클릭해 연결할 모듈을 선택하세요.":"Select the button on the right to choose a module to connect.",
  "봇스테이션":"Botstation","채널":"Channel","전체 채널":"All channels","채널 연결 정보":"Channel connection information","연결":"Connect","연결 유형":"Connection type","채널 아이디":"Channel ID","인증방식":"Authentication method",
  "관리자 기능에 등록된 채널이 없습니다.":"No channels are registered in Admin.","이 화면의 입력값은 메신저 연동 상세정보 팝업과 동일한 연결 정보입니다.":"The values on this screen are the same connection information shown in the messenger connection details dialog.",
  "봇 메시지":"Bot message","사용자 메시지":"User message","봇 메시지 추가":"Add bot message","사용자 메시지 추가":"Add user message","등록된 봇 메시지가 없습니다.":"No bot messages are registered.","등록된 사용자 메시지가 없습니다.":"No user messages are registered.",
  "봇 메시지가 될 수 있는 문장을 입력하십시오. 메시지는 사용자에게 무작위로 표시됩니다.":"Enter sentences that can be bot messages. Messages are shown to users at random.","사용자 메시지가 될 수 있는 문장을 입력하세요.":"Enter sentences that can be user messages.",
  "파일 다운로드":"Download file","파일 메뉴":"File menu","전체 결과":"All results","더보기":"More","처음으로":"First","재학습":"Retraining","학습 반영":"Apply training",
  "처리 결과":"Processing result","학습상태":"Training status","학습 완료 시간":"Training time","발생 일시":"Occurred at","등록일자":"Registered at","등록자":"Created by","최종수정자":"Modified by",
  "없음":"None","선택 안 함":"Do not select","모든 의도 사용":"Use all intents","의도별 사용":"Use by intent","의도명":"Intent name","유형":"Type","설명":"Description","값":"Value","메시지":"Message","우선순위":"Priority","반영":"Apply","목록에 반영":"Apply to list",
  "PC 이미지 선택":"Select PC image","PNG, JPEG, WEBP · 2MB 이하":"PNG, JPEG, WEBP · up to 2MB","현재 프로필":"Current profile","프로필 설정":"Profile settings","메인 화면으로":"Go to main screen"
};

const ko: StudioPageCatalog = { labels: {} };
const en: StudioPageCatalog = { labels: enLabels };
const locale = (labels: Record<string, string>): StudioPageCatalog => ({ labels: { ...enLabels, ...labels } });
export const STUDIO_PAGE_CATALOGS = {
  ko: ko,
  en: en,
  "zh-CN": locale({ ...STUDIO_PAGE_NATIVE_ADDITIONAL["zh-CN"], ...STUDIO_PAGE_COMPLETE_NATIVE["zh-CN"], "기본 설정":"基本设置","설정":"设置","저장":"保存","삭제":"删除","취소":"取消","확인":"确认","봇 허브":"机器人中心","봇 허브 구성":"机器人中心配置","봇 허브 설정":"机器人中心设置","봇 허브 재학습":"机器人中心再训练","룰 설정":"规则设置","스몰토크":"闲聊","플로팅 버튼":"浮动按钮","추천 의도":"推荐意图","채널":"渠道" }),
  ja: locale({ ...STUDIO_PAGE_NATIVE_ADDITIONAL["ja"], ...STUDIO_PAGE_COMPLETE_NATIVE.ja, "기본 설정":"基本設定","설정":"設定","저장":"保存","삭제":"削除","취소":"キャンセル","확인":"確認","봇 허브":"ボットハブ","봇 허브 구성":"ボットハブ構成","봇 허브 설정":"ボットハブ設定","봇 허브 재학습":"ボットハブ再学習","룰 설정":"ルール設定","스몰토크":"スモールトーク","플로팅 버튼":"フローティングボタン","추천 의도":"おすすめインテント","채널":"チャネル" }),
  vi: locale({ ...STUDIO_PAGE_NATIVE_ADDITIONAL["vi"], ...STUDIO_PAGE_COMPLETE_NATIVE.vi, "기본 설정":"Cài đặt cơ bản","설정":"Cài đặt","저장":"Lưu","삭제":"Xóa","취소":"Hủy","확인":"Xác nhận","봇 허브":"Trung tâm bot","봇 허브 구성":"Cấu hình trung tâm bot","봇 허브 설정":"Cài đặt trung tâm bot","봇 허브 재학습":"Huấn luyện lại trung tâm bot","룰 설정":"Cài đặt quy tắc","스몰토크":"Trò chuyện nhỏ","플로팅 버튼":"Nút nổi","추천 의도":"Ý định đề xuất","채널":"Kênh" }),
  fr: locale({ ...STUDIO_PAGE_NATIVE_ADDITIONAL["fr"], ...STUDIO_PAGE_COMPLETE_NATIVE.fr, "기본 설정":"Paramètres de base","설정":"Paramètres","저장":"Enregistrer","삭제":"Supprimer","취소":"Annuler","확인":"Confirmer","봇 허브":"Hub de bots","봇 허브 구성":"Composition du hub","봇 허브 설정":"Paramètres du hub","봇 허브 재학습":"Réentraînement du hub","룰 설정":"Paramètres des règles","스몰토크":"Petite conversation","플로팅 버튼":"Boutons flottants","추천 의도":"Intentions recommandées","채널":"Canal" }),
  de: locale({ ...STUDIO_PAGE_NATIVE_ADDITIONAL["de"], ...STUDIO_PAGE_COMPLETE_NATIVE.de, "기본 설정":"Grundeinstellungen","설정":"Einstellungen","저장":"Speichern","삭제":"Löschen","취소":"Abbrechen","확인":"Bestätigen","봇 허브":"Bot-Hub","봇 허브 구성":"Bot-Hub-Zusammenstellung","봇 허브 설정":"Bot-Hub-Einstellungen","봇 허브 재학습":"Bot-Hub-Nachtraining","룰 설정":"Regeleinstellungen","스몰토크":"Smalltalk","플로팅 버튼":"Schwebende Schaltflächen","추천 의도":"Empfohlene Intents","채널":"Kanal" }),
} satisfies Record<SupportedLanguage, StudioPageCatalog>;

export function getStudioPageLabel(copy: StudioPageCatalog, value: string): string {
  return copy.labels[value] ?? (copy === ko ? value : enLabels[value] ?? value);
}