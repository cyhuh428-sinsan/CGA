import type { SupportedLanguage } from "@/lib/language";

export type FlowDesignerCatalog = {
  loadFailed: string;
  labels: Record<string, string>;
};

const enLabels: Record<string, string> = {
  "조회모드 입장": "Enter view mode", "닫기": "Close", "취소": "Cancel", "확인": "Confirm",
  "대화 설계": "Conversation design", "대화 시작": "Conversation start", "대화 경로": "Conversation path",
  "대화 설계 안내": "Conversation design help", "봇 메시지를 검색하세요.": "Search bot messages.",
  "저장 중...": "Saving...", "저장": "Save", "대화설계 메뉴": "Conversation design menu",
  "대화설계 업로드": "Upload conversation design", "대화설계 다운로드": "Download conversation design",
  "현재 대화 설계는 조회 모드입니다. 다른 사용자의 편집 잠금이 해제된 뒤 수정할 수 있습니다.": "This conversation design is in view mode. You can edit it after the other user's edit lock is released.",
  "의도": "Intent", "모듈": "Module", "카드": "card(s)", "링크": "Link(s)", "개": "",
  "필수 변수 기본 반복": "Default required-variable repetitions", "회": "",
  "마우스로 다음 카드를 연결 중": "Connecting the next card with the mouse",
  "다음 카드를 캔버스에서 선택 중": "Selecting the next card on the canvas",
  "저장되지 않은 변경사항": "Unsaved changes", "대화 테스트": "Conversation test", "속성": "Properties", "변수": "Variables",
  "전체 화면": "Full screen", "저장하지 않은 변경사항은 시뮬레이터에 반영되지 않을 수 있습니다.": "Unsaved changes may not appear in the bot test.",
  "변수명": "Variable name", "설정한 카드": "Configured card", "구분": "Type", "설명": "Description",
  "표시할 변수가 없습니다.": "No variables to display.", "카드 이름": "Card name", "대화 시작 카드": "Conversation start card", "기본 변수 카드": "Default variables card", "Talk 카드": "Talk card", "Jump 카드": "Jump card", "Condition 카드": "Condition card", "Function 카드": "Function card", "Variable 카드": "Variable card", "Script 카드": "Script card", "End 카드": "End card",
  "대화 설계 화면을 불러오는 중입니다...": "Loading the conversation design screen...",
  "등록된 의도/모듈을 찾을 수 없습니다.": "No registered intent or module was found.",
  "대화 설계가 저장되었습니다.": "Conversation design was saved.", "대화 설계를 저장하지 못했습니다.": "Failed to save the conversation design.",
  "대화 설계 정보를 불러오지 못했습니다.": "Failed to load conversation design information.",
  "조회모드에서는 대화 설계를 수정할 수 없습니다.": "Conversation design cannot be edited in view mode.",
  "조회모드에서는 대화 설계를 저장할 수 없습니다.": "Conversation design cannot be saved in view mode.",
  "변경사항이 저장되지 않았습니다. 다른 화면으로 이동하시겠습니까?": "Changes have not been saved. Do you want to leave this screen?",
  "변경사항이 저장되지 않았습니다. 저장된 내용 기준으로 테스트 화면을 열겠습니까?": "Changes have not been saved. Open the bot test using the last saved design?",
  "대화설계 파일을 확인해주세요.": "Check the conversation design file.",
  "대화설계 업로드가 반영되었습니다. 저장을 눌러 적용하세요.": "The conversation design upload was applied. Select Save to apply it.",
  "현재 편집자": "Current editor", "님이 대화 설계를 편집 중입니다. 조회모드로 들어가시겠습니까? 조회모드에서는 대화 설계를 수정하거나 저장할 수 없습니다.": " is editing the conversation design. Enter view mode? You cannot edit or save in view mode.",
};

Object.assign(enLabels, {
  "+ 메시지 추가":"+ Add message","+ 입력 추가하기":"+ Add input","+ 플로팅 버튼 추가":"+ Add floating button","+ Table Row 추가":"+ Add table row",
  "값 1":"Value 1","값 추가":"Add value","개체값":"Entity value","개체명":"Entity name","결과":"Result","글꼴":"Font",
  "기본 메시지":"Default message","기본 변수 카드":"Default variables card","꺾임점":"Waypoint","내장 함수":"Built-in function","다른 대화":"Another conversation",
  "다음":"Next","다음 카드":"Next card","단축키":"Shortcuts","대화 설계하기":"Design conversation","대화 유형":"Conversation type","도착 카드":"Target card",
  "등록된 개체 없음":"No registered entities","등록된 입력 Parameter가 없습니다.":"No input parameters are registered.","등록된 Method가 없습니다.":"No methods are registered.",
  "라벨 숨기기":"Hide label","랜덤 메시지":"Random messages","로컬 변수":"Local variable","로컬변수":"Local variable","리스트 변수":"List variable",
  "리스트 변수에 등록된 Column 키값이 없습니다.":"No column keys are registered in the list variable.","리턴 변수 설정":"Return variable settings","리턴 변수 추가하기":"Add return variable",
  "링크":"Link","링크 모양":"Link shape","메시지":"Message","메시지를 입력하세요.":"Enter a message.","모듈대화 목록":"Module conversation list","문단":"Paragraph",
  "문법 확인":"Check syntax","미선택":"Not selected","반복횟수":"Repeat count","버튼명":"Button name","버튼명을 입력하세요.":"Enter a button name.",
  "변수 값 선택":"Select variable value","변수 설정":"Variable settings","변수 정의":"Variable definition","변수 추가하기":"Add variable","변수값":"Variable value",
  "변수값을 입력하세요.":"Enter a variable value.","변수를 입력하세요.":"Enter a variable.","변수명 정렬":"Sort variable names","변수유형":"Variable type",
  "비교값":"Comparison value","사용":"Use","사용 가능 변수":"Available variables","사용자 응답 처리":"User response handling","사용자 카드":"User card","삭제":"Delete",
  "상세 설명":"Detailed description","상세 설명을 입력하세요.":"Enter a detailed description.","상세 설정":"Detailed settings","생성 상태":"Generation status",
  "선 모양 초기화":"Reset line shape","선택 개체 추가":"Add selected entity","설명":"Description","스크립트 변수명":"Script variable name","스크립트 코드":"Script code",
  "스크립트 코드 편집":"Edit script code","시작 카드":"Start card","아직 추출할 개체가 선택되지 않았습니다.":"No entities have been selected for extraction.",
  "연결 기준":"Connection criteria","연결 안 함":"Do not connect","연결 정보":"Connection information","예":"Yes","예시":"Example","예외":"Exception","예외 처리":"Exception handling",
  "예외 카드 연결":"Connect exception card","유형":"Type","응답 내 개체 추출":"Extract entities from response","의도/모듈":"Intent/Module","의도/모듈 목록":"Intent/Module list",
  "의도/모듈명을 검색하세요.":"Search intent/module names.","의도/모듈을 선택하세요.":"Select an intent/module.","의도전환잠금":"Lock intent switching",
  "이 대화의 카드":"Cards in this conversation","이동 대상":"Move target","이동 설정":"Move settings","이름":"Name","이미 추가됨":"Already added","이미지 URL을 입력하세요.":"Enter an image URL.",
  "이전":"Previous","입력 없음":"No input","입력 종료 문자":"Input terminator","입력 Parameter":"Input parameter","입력 Parameter 변수":"Input parameter variable",
  "저장":"Save","적용하면 현재 Script 카드에 Adaptive Card JSON을 $adaptiveCard, $msgKey 변수로 저장하는 코드가 들어갑니다.":"Applying inserts code into the current Script card that stores the Adaptive Card JSON in the $adaptiveCard and $msgKey variables.",
  "접기/펼치기":"Collapse/Expand","제목을 입력하세요.":"Enter a title.","조건":"Condition","종료 설정":"End settings","직접 설정":"Set directly","챗봇 메시지":"Chatbot message",
  "최대 반복횟수":"Maximum repeat count","출력 Parameter":"Output parameter","출력 Parameter 변수":"Output parameter variable","카드":"Card","카드 목록":"Card list","카드 삭제":"Delete card",
  "카드를 선택하세요.":"Select a card.","카드명을 검색하세요.":"Search card names.","캔버스에서 다음 카드 선택":"Select next card on canvas","크기":"Size","키 값 선택":"Select key value",
  "키값을 입력하세요. 엔터키로 구분됩니다.(최대 100자)":"Enter key values separated by Enter (up to 100 characters).","타이틀":"Title","타이틀을 입력하세요.":"Enter a title.",
  "테이블 값 설정":"Table value settings","테이블 변수 사용":"Use table variable","테이블 사용":"Use table","텍스트를 입력하세요.":"Enter text.","템플릿 메시지":"Template message",
  "템플릿 메시지 설정":"Template message settings","템플릿 선택":"Select template","파라미터":"Parameter","파라미터 값":"Parameter value","파라미터 추가하기":"Add parameter",
  "파라미터명":"Parameter name","편집 팝업 열기":"Open edit dialog","플로팅 버튼":"Floating button","필수 변수":"Required variable","필수 변수 반복":"Required-variable repetition",
  "함수":"Function","흐름 설정":"Flow settings","Adaptive Card 디자이너":"Adaptive Card Designer","API 메서드":"API method","API 목록":"API list","API 선택":"Select API",
  "API 속성":"API properties","API 이름":"API name","API Method 목록":"API method list","API와 Method를 선택하세요.":"Select an API and method.","Carousel Item 설정":"Carousel item settings",
  "Column 값을 입력하세요.":"Enter a column value.","Data 타입":"Data type","Function 카드 설정":"Function card settings","Method를 선택하세요.":"Select a method.",
  "Script 반영":"Apply script","Script에 적용":"Apply to script","Session 바로 종료":"End session immediately","TTS 테스트":"TTS test",
  "7가지 종류의 대화카드를 Drag & Drop으로 캔버스에 옮겨 사용하세요.":"Drag and drop the seven conversation card types onto the canvas.",
  "다른 대화로 이동할 수 있는 Jump Card,":"A Jump Card that moves to another conversation,","대화 종료를 선언하는 End Card.":"and an End Card that declares the end of the conversation.",
  "대화에서 사용할 개체를 검색하여 파라미터로 등록하세요.":"Search for entities to use in the conversation and register them as parameters.","대화에서 추출할 개체를 선택하세요.":"Select entities to extract from the conversation.",
  "기간계 API 함수와 대화 변수를 매핑하는 Function Card,":"a Function Card that maps backend API functions to conversation variables,",
  "변수를 선언하는 Variable Card,":"a Variable Card that declares variables,","봇과 사용자의 말을 쌍으로 정의하는 Talk Card,":"a Talk Card that defines bot and user messages as pairs,",
  "자바스크립트로 코드를 작성하여 메시지나 변수를 정의하는 Script Card,":"a Script Card that defines messages or variables with JavaScript,",
  "조건에 따라 대화를 분기하여 설계하는 Condition Card,":"a Condition Card that branches the conversation by conditions,",
  "JavaScript ES2020 기준으로 작성합니다. 실행 환경 제한은 런타임 정책에서 별도로 적용됩니다.":"Write JavaScript according to ES2020. Runtime restrictions are applied separately by runtime policy.",
  "모든 대화는 End Card로 종료해야하며 End Card가 없을 시 최종 저장이 되지않아 봇이 대화를 학습할 수 없습니다. 꼭 End Card로 설계를 끝맺음 하세요.":"Every conversation must end with an End Card. Without one, the final design cannot be saved and the bot cannot learn the conversation.",
  "저장 : Ctrl + S":"Save: Ctrl + S","파일 업로드 : Ctrl + U":"Upload file: Ctrl + U","파일 다운로드 : Ctrl + D":"Download file: Ctrl + D",
  "대화시작으로 이동 : Ctrl + <":"Go to conversation start: Ctrl + <","선택된 셀 복사하기 : Ctrl + Shift + C":"Copy selected cells: Ctrl + Shift + C",
  "선택된 셀 붙여넣기 : Ctrl + Shift + V":"Paste selected cells: Ctrl + Shift + V","선택된 셀 삭제 : Del":"Delete selected cells: Del",
  "선택된 셀 아래 이동 : ↓ (방향키)":"Move selected cells down: ↓","선택된 셀 오른쪽 이동 : → (방향키)":"Move selected cells right: →",
  "선택된 셀 왼쪽 이동 : ← (방향키)":"Move selected cells left: ←","선택된 셀 위로 이동 : ↑ (방향키)":"Move selected cells up: ↑",
  "셀 선택 : 마우스 왼쪽 클릭, 마우스 드래그":"Select cells: left click or drag","셀 선택 해제 : 셀 선택 Ctrl + 마우스 왼쪽 클릭, 캔버스 영역 클릭":"Deselect cells: Ctrl + left click or click the canvas",
  "디버그 모드 : Alt + 셀 선택":"Debug mode: Alt + select cell"
});
const ko: FlowDesignerCatalog = { loadFailed: "대화 설계 정보를 불러오지 못했습니다.", labels: {} };
const en: FlowDesignerCatalog = { loadFailed: "Failed to load conversation design information.", labels: enLabels };
const locale = (loadFailed: string, labels: Record<string, string>): FlowDesignerCatalog => ({ loadFailed, labels: { ...enLabels, ...labels } });

export const FLOW_DESIGNER_CATALOGS = {
  ko: ko,
  en: en,
  "zh-CN": locale("无法加载对话设计信息。", { "대화 설계": "对话设计", "대화 시작": "开始对话", "저장": "保存", "저장 중...": "正在保存...", "대화 테스트": "对话测试", "속성": "属性", "변수": "变量", "전체 화면": "全屏", "닫기": "关闭", "취소": "取消", "확인": "确认", "카드 이름": "卡片名称" }),
  ja: locale("会話設計情報を読み込めませんでした。", { "대화 설계": "会話設計", "대화 시작": "会話開始", "저장": "保存", "저장 중...": "保存中...", "대화 테스트": "会話テスト", "속성": "プロパティ", "변수": "変数", "전체 화면": "全画面", "닫기": "閉じる", "취소": "キャンセル", "확인": "確認", "카드 이름": "カード名" }),
  vi: locale("Không thể tải thông tin thiết kế hội thoại.", { "대화 설계": "Thiết kế hội thoại", "대화 시작": "Bắt đầu hội thoại", "저장": "Lưu", "저장 중...": "Đang lưu...", "대화 테스트": "Kiểm thử hội thoại", "속성": "Thuộc tính", "변수": "Biến", "전체 화면": "Toàn màn hình", "닫기": "Đóng", "취소": "Hủy", "확인": "Xác nhận", "카드 이름": "Tên thẻ" }),
  fr: locale("Impossible de charger la conception de conversation.", { "대화 설계": "Conception de conversation", "대화 시작": "Début de conversation", "저장": "Enregistrer", "저장 중...": "Enregistrement...", "대화 테스트": "Test de conversation", "속성": "Propriétés", "변수": "Variables", "전체 화면": "Plein écran", "닫기": "Fermer", "취소": "Annuler", "확인": "Confirmer", "카드 이름": "Nom de la carte" }),
  de: locale("Die Gesprächsgestaltung konnte nicht geladen werden.", { "대화 설계": "Gesprächsgestaltung", "대화 시작": "Gesprächsbeginn", "저장": "Speichern", "저장 중...": "Speichern...", "대화 테스트": "Gesprächstest", "속성": "Eigenschaften", "변수": "Variablen", "전체 화면": "Vollbild", "닫기": "Schließen", "취소": "Abbrechen", "확인": "Bestätigen", "카드 이름": "Kartenname" }),
} satisfies Record<SupportedLanguage, FlowDesignerCatalog>;

export function getFlowDesignerLabel(copy: FlowDesignerCatalog, value: string): string {
  return copy.labels[value] ?? (copy === ko ? value : enLabels[value] ?? value);
}