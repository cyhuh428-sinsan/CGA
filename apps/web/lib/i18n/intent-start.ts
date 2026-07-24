import type { SupportedLanguage } from "@/lib/language";

export type IntentStartCatalog = {
  trainingSentenceSearch: string;
  extractEntities: string;
  labels: Record<string, string>;
};

const enLabels: Record<string, string> = {
  "학습문장 수정":"Edit training sentence",
  "저장 실패":"Save failed","닫기":"Close","변경사항이 저장이 되지 않았습니다.":"Changes were not saved.","취소":"Cancel","확인":"Confirm",
  "조회모드 입장":"Enter view mode","챗봇 메시지 설정":"Chatbot message settings","메시지":"Message","사용자에게 개체를 얻기 위한 질문을 입력하세요.":"Enter a question that asks the user for the entity.",
  "대화 시작 설정을 불러오는 중입니다...":"Loading conversation-start settings...","등록된 의도를 찾을 수 없습니다.":"The intent could not be found.","대화 시작":"Conversation start","대화 시작 안내":"Conversation-start guide",
  "Validation 오류 보기":"View validation errors","학습문장을 검색하세요.":"Search training sentences.","검색어 지우기":"Clear search","바꿀 내용을 입력하세요.":"Enter replacement text.","학습문장 메뉴":"Training sentence menu",
  "구분":"Type","학습문장":"Training sentence","봇과 대화를 시작할 때 사용자가 입력할 만한 문장을 입력하고 Enter를 눌러주세요.":"Enter a sentence a user might say when starting a conversation, then press Enter.",
  "전체 선택":"Select all","추출할 개체":"Entities to extract","대화에서 사용할 개체를 검색하여 파라미터로 등록하세요.":"Search entities used in the conversation and register them as parameters.","개체 후보 전체 선택":"Select all entity candidates","개체명":"Entity name","개체값":"Entity value","이미 추가됨":"Already added","개체 전체 선택":"Select all entities",
  "변수명":"Variable name","필수 변수":"Required variable","로컬 변수":"Local variable","챗봇 메시지":"Chatbot message","파일 업로드":"File upload","아래의 버튼으로 양식(.txt)을 다운받으신 후, 파일을 업로드 하세요.":"Download the .txt template below, fill it in, and upload the file.",
  "UTF-8 형식으로 인코딩된 .txt/.csv 파일을 통해 학습문장을 한꺼번에 업로드할 수 있습니다.":"Upload training sentences in bulk with a UTF-8 encoded .txt or .csv file.","쉼표(,)로 구분하는 CSV 형식을 사용하세요.":"Use comma-separated CSV format.","구분값은 T 또는 V만 허용합니다. 생략하면 T로 등록됩니다.":"Only T or V is allowed for the type. If omitted, T is used.","한 줄에 한 개의 학습문장을 입력하세요.":"Enter one training sentence per line.","업로드 결과":"Upload results",
  "대화시작 하기":"Configure conversation start","학습문장과 개체를 등록하고 관리할 수 있습니다.":"Register and manage training sentences and entities.","단축키":"Keyboard shortcuts","대화시작 저장: Ctrl + S":"Save conversation start: Ctrl + S","대화시작표현 파일 다운로드: Ctrl + D":"Download conversation-start expressions: Ctrl + D","대화시작표현 파일 업로드: Ctrl + U":"Upload conversation-start expressions: Ctrl + U","대화시작 저장 후 대화설계 이동: Ctrl + >":"Save and open conversation design: Ctrl + >","새로운 개체: Ctrl + E":"New entity: Ctrl + E",
  "저장":"Save","삭제":"Delete","수정":"Edit","추가":"Add","대화 설계":"Conversation design","파일 다운로드":"Download file","대화 시작 표현":"Conversation-start expression","새로운 개체":"New entity","필수":"Required","선택":"Optional","사용":"Use","미사용":"Do not use"
};

const makeCatalog = (overrides: Record<string, string>): IntentStartCatalog => {
  const labels = { ...enLabels, ...overrides };
  return {
    trainingSentenceSearch: labels["학습문장을 검색하세요."],
    extractEntities: labels["추출할 개체"],
    labels,
  };
};

export const INTENT_START_CATALOGS = {
  ko: makeCatalog(Object.fromEntries(Object.keys(enLabels).map((key) => [key, key]))),
  en: makeCatalog({}),
  "zh-CN": makeCatalog({ "저장 실패":"保存失败","닫기":"关闭","취소":"取消","확인":"确认","조회모드 입장":"进入查看模式","챗봇 메시지 설정":"聊天机器人消息设置","메시지":"消息","대화 시작":"对话开始","대화 시작 안내":"对话开始指南","학습문장을 검색하세요.":"搜索训练语句。","검색어 지우기":"清除搜索","구분":"类型","학습문장":"训练语句","전체 선택":"全选","추출할 개체":"要提取的实体","개체명":"实体名称","개체값":"实体值","이미 추가됨":"已添加","변수명":"变量名","필수 변수":"必填变量","로컬 변수":"局部变量","챗봇 메시지":"聊天机器人消息","파일 업로드":"上传文件","업로드 결과":"上传结果","대화시작 하기":"配置对话开始","단축키":"快捷键","저장":"保存","삭제":"删除","수정":"修改","추가":"添加","대화 설계":"对话设计","파일 다운로드":"下载文件","새로운 개체":"新建实体","필수":"必填","선택":"可选","사용":"使用","미사용":"不使用" }),
  ja: makeCatalog({ "저장 실패":"保存失敗","닫기":"閉じる","취소":"キャンセル","확인":"確認","조회모드 입장":"閲覧モードに入る","챗봇 메시지 설정":"チャットボットメッセージ設定","메시지":"メッセージ","대화 시작":"対話開始","대화 시작 안내":"対話開始ガイド","학습문장을 검색하세요.":"学習文を検索してください。","검색어 지우기":"検索語を消去","구분":"区分","학습문장":"学習文","전체 선택":"すべて選択","추출할 개체":"抽出するエンティティ","개체명":"エンティティ名","개체값":"エンティティ値","이미 추가됨":"追加済み","변수명":"変数名","필수 변수":"必須変数","로컬 변수":"ローカル変数","챗봇 메시지":"チャットボットメッセージ","파일 업로드":"ファイルをアップロード","업로드 결과":"アップロード結果","대화시작 하기":"対話開始を設定","단축키":"ショートカット","저장":"保存","삭제":"削除","수정":"編集","추가":"追加","대화 설계":"対話設計","파일 다운로드":"ファイルをダウンロード","새로운 개체":"新規エンティティ","필수":"必須","선택":"任意","사용":"使用","미사용":"未使用" }),
  vi: makeCatalog({ "저장 실패":"Lưu thất bại","닫기":"Đóng","취소":"Hủy","확인":"Xác nhận","조회모드 입장":"Vào chế độ xem","챗봇 메시지 설정":"Cài đặt tin nhắn chatbot","메시지":"Tin nhắn","대화 시작":"Bắt đầu hội thoại","대화 시작 안내":"Hướng dẫn bắt đầu hội thoại","학습문장을 검색하세요.":"Tìm câu huấn luyện.","검색어 지우기":"Xóa tìm kiếm","구분":"Loại","학습문장":"Câu huấn luyện","전체 선택":"Chọn tất cả","추출할 개체":"Thực thể cần trích xuất","개체명":"Tên thực thể","개체값":"Giá trị thực thể","이미 추가됨":"Đã thêm","변수명":"Tên biến","필수 변수":"Biến bắt buộc","로컬 변수":"Biến cục bộ","챗봇 메시지":"Tin nhắn chatbot","파일 업로드":"Tải tệp lên","업로드 결과":"Kết quả tải lên","대화시작 하기":"Cấu hình bắt đầu hội thoại","단축키":"Phím tắt","저장":"Lưu","삭제":"Xóa","수정":"Sửa","추가":"Thêm","대화 설계":"Thiết kế hội thoại","파일 다운로드":"Tải tệp xuống","새로운 개체":"Thực thể mới","필수":"Bắt buộc","선택":"Tùy chọn","사용":"Dùng","미사용":"Không dùng" }),
  fr: makeCatalog({ "저장 실패":"Échec de l’enregistrement","닫기":"Fermer","취소":"Annuler","확인":"Confirmer","조회모드 입장":"Passer en mode consultation","챗봇 메시지 설정":"Paramètres du message du chatbot","메시지":"Message","대화 시작":"Début de conversation","대화 시작 안내":"Guide du début de conversation","학습문장을 검색하세요.":"Rechercher des phrases d’entraînement.","검색어 지우기":"Effacer la recherche","구분":"Type","학습문장":"Phrase d’entraînement","전체 선택":"Tout sélectionner","추출할 개체":"Entités à extraire","개체명":"Nom de l’entité","개체값":"Valeur de l’entité","이미 추가됨":"Déjà ajouté","변수명":"Nom de variable","필수 변수":"Variable requise","로컬 변수":"Variable locale","챗봇 메시지":"Message du chatbot","파일 업로드":"Importer un fichier","업로드 결과":"Résultats de l’import","대화시작 하기":"Configurer le début de conversation","단축키":"Raccourcis clavier","저장":"Enregistrer","삭제":"Supprimer","수정":"Modifier","추가":"Ajouter","대화 설계":"Conception du dialogue","파일 다운로드":"Télécharger le fichier","새로운 개체":"Nouvelle entité","필수":"Requis","선택":"Facultatif","사용":"Utiliser","미사용":"Ne pas utiliser" }),
  de: makeCatalog({ "저장 실패":"Speichern fehlgeschlagen","닫기":"Schließen","취소":"Abbrechen","확인":"Bestätigen","조회모드 입장":"Ansichtsmodus öffnen","챗봇 메시지 설정":"Chatbot-Nachrichteneinstellungen","메시지":"Nachricht","대화 시작":"Dialogstart","대화 시작 안내":"Anleitung zum Dialogstart","학습문장을 검색하세요.":"Trainingssätze suchen.","검색어 지우기":"Suche löschen","구분":"Typ","학습문장":"Trainingssatz","전체 선택":"Alle auswählen","추출할 개체":"Zu extrahierende Entitäten","개체명":"Entitätsname","개체값":"Entitätswert","이미 추가됨":"Bereits hinzugefügt","변수명":"Variablenname","필수 변수":"Pflichtvariable","로컬 변수":"Lokale Variable","챗봇 메시지":"Chatbot-Nachricht","파일 업로드":"Datei hochladen","업로드 결과":"Upload-Ergebnis","대화시작 하기":"Dialogstart konfigurieren","단축키":"Tastenkürzel","저장":"Speichern","삭제":"Löschen","수정":"Bearbeiten","추가":"Hinzufügen","대화 설계":"Dialogentwurf","파일 다운로드":"Datei herunterladen","새로운 개체":"Neue Entität","필수":"Erforderlich","선택":"Optional","사용":"Verwenden","미사용":"Nicht verwenden" }),
} satisfies Record<SupportedLanguage, IntentStartCatalog>;

export function getIntentStartLabel(copy: IntentStartCatalog, value: string): string {
  return copy.labels[value] ?? value;
}