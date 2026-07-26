import type { SupportedLanguage } from "@/lib/language";

export type GettingStartedCourseId = "explore" | "create";

export type GettingStartedStep = {
  section: string;
  title: string;
  description: string;
};

export type GettingStartedCourse = {
  description: string;
  steps: readonly GettingStartedStep[];
};

export type GettingStartedCatalog = {
  courses: Record<GettingStartedCourseId, GettingStartedCourse>;
  previous: string;
  next: string;
  finish: string;
  finished: string;
  switchCourse: string;
  progress: string;
};

export const GETTING_STARTED_CATALOGS = {
  ko: {
    courses: {
      explore: {
        description: "Bot·API·Admin과 봇 운영 화면을 순서대로 살펴봅니다.",
        steps: [
          { section: "Bot", title: "봇을 생성하고 관리하세요", description: "Bot 메뉴에서 봇 유형과 상태를 확인하고 작업할 봇을 선택합니다. CGA에서는 현재 개별 봇을 중심으로 운영합니다." },
          { section: "API", title: "외부 업무 시스템을 API로 연결하세요", description: "API 메뉴에서 대화 중 호출할 외부 API와 메서드를 등록하고, 봇 버전의 API 자산에서 사용할 연결을 구성합니다." },
          { section: "Admin", title: "사용자와 운영 현황을 관리하세요", description: "Admin 메뉴에서 사용자·그룹·채널·템플릿을 관리하고 대화·Queue·학습·API 이력과 시스템 상태를 확인합니다." },
          { section: "봇 구성", title: "의도와 학습문장을 관리하세요", description: "의도 화면에서 사용자 발화를 업무로 분류할 기준을 만들고, 실제 표현을 반영한 학습문장을 등록합니다." },
          { section: "봇 구성", title: "개체와 사전으로 핵심 정보를 찾으세요", description: "개체로 날짜·지역·상품명 같은 값을 추출하고, 사전으로 동의어와 같은 의미의 표현을 일관되게 관리합니다." },
          { section: "평가", title: "학습 결과의 정확도를 평가하세요", description: "평가 데이터로 분류 결과를 검증하고 오분류 문장, 낮은 Score 문장, 유사 의도 충돌을 확인합니다." },
          { section: "재학습", title: "실제 대화 발화를 재학습에 반영하세요", description: "실제 대화에서 보정할 발화를 선택하고 올바른 의도나 지식으로 분류한 뒤 검토된 데이터만 재학습에 반영합니다." },
          { section: "분석", title: "대화량과 응답 결과를 분석하세요", description: "기간과 채널별 대화량·응답률·분류 방식·미응답 현황을 확인하고 다음 평가와 재학습 대상을 정합니다." },
        ],
      },
      create: {
        description: "봇 생성부터 학습과 봇 테스트 검증까지 따라갑니다.",
        steps: [
          { section: "봇 생성", title: "새 봇의 기본 정보를 입력하세요", description: "봇 유형, 프로필, 이름, 설명과 언어를 지정합니다. 봇 ID는 생성 후 UUID로 부여되며 이후 설정과 채널 연결의 기준이 됩니다." },
          { section: "엔진 선택", title: "의도인식 방식을 선택하세요", description: "학습문장 분류는 ML, 의미 유사도 검색은 Semantic, 생성형 의도 해석은 LLM Engine을 서비스 목적에 맞춰 선택합니다." },
          { section: "엔진 선택", title: "모델과 답변 방식을 확인하세요", description: "NLU 모델과 정해진 답변·Semantic RAG·LLM RAG·LLM 답변 중 지원되는 조합을 확인하고 필요한 Provider와 모델을 설정합니다." },
          { section: "의도 등록", title: "처리할 의도와 학습문장을 만드세요", description: "한 의도에는 하나의 업무 목적을 담고, 같은 뜻의 표현·어순·조사 변화를 포함한 실제 사용자 문장을 등록합니다." },
          { section: "대화 설계", title: "개체·사전·대화 흐름을 구성하세요", description: "필요한 값을 개체와 사전으로 정의하고 Start부터 답변·조건·API·변수 카드를 연결해 분기와 종료 조건을 만듭니다." },
          { section: "학습", title: "저장한 구성으로 학습을 실행하세요", description: "의도·학습문장·개체·사전·대화 흐름을 저장한 뒤 학습을 요청하고, 학습 이력에서 처리 상태와 성공 결과를 확인합니다." },
          { section: "봇 테스트", title: "질문과 분석 데이터를 확인하세요", description: "대표 질문과 경계 표현을 입력해 선택 의도, 적용 단계, 대화카드, 변수와 최종 응답이 예상대로인지 확인합니다." },
          { section: "품질 개선", title: "평가·재학습·분석으로 개선하세요", description: "오분류와 낮은 Score를 보완하고 실제 대화의 실패 발화를 재학습한 뒤 동일한 테스트 세트로 다시 검증합니다." },
        ],
      },
    },
    previous: "이전", next: "다음", finish: "체험 종료", finished: "체험을 마쳤습니다.", switchCourse: "다른 과정 보기", progress: "{current} / {total}",
  },
  en: {
    courses: {
      explore: {
        description: "Review Bot, API, Admin, and bot operations in sequence.",
        steps: [
          { section: "Bot", title: "Create and manage bots", description: "Use Bot to review bot types and states, then select the bot you want to work on. CGA currently operates around individual bots." },
          { section: "API", title: "Connect external business systems", description: "Register external APIs and methods used during conversations, then configure the connections available to each bot version." },
          { section: "Admin", title: "Manage users and operations", description: "Manage users, groups, channels, and templates, and review conversation, queue, training, API, and system status history." },
          { section: "Bot setup", title: "Manage intents and training utterances", description: "Define how user utterances map to business intents and add realistic training expressions." },
          { section: "Bot setup", title: "Extract key information", description: "Use entities for values such as dates and products, and dictionaries for synonyms and equivalent expressions." },
          { section: "Evaluation", title: "Evaluate classification quality", description: "Validate results with evaluation data and review misclassified, low-score, and conflicting intents." },
          { section: "Retraining", title: "Feed reviewed conversations back into training", description: "Select utterances that need correction, assign the proper intent or knowledge, and retrain only reviewed data." },
          { section: "Analytics", title: "Analyze conversations and responses", description: "Review traffic, response rate, classification method, and unanswered results by period and channel." },
        ],
      },
      create: {
        description: "Follow bot creation through training and Bot Test verification.",
        steps: [
          { section: "Create bot", title: "Enter basic bot information", description: "Choose the bot type and profile, then enter its name, description, and language. CGA assigns a UUID after creation." },
          { section: "Engine", title: "Choose an intent-recognition method", description: "Use ML for training-utterance classification, Semantic for similarity search, or LLM Engine for generative intent interpretation." },
          { section: "Engine", title: "Confirm model and response mode", description: "Select a supported combination of NLU model and fixed, Semantic RAG, LLM RAG, or LLM response mode." },
          { section: "Intent", title: "Create intents and training utterances", description: "Keep one business purpose per intent and add realistic paraphrases, word-order changes, and particles." },
          { section: "Conversation", title: "Configure entities, dictionaries, and flows", description: "Define extracted values and connect Start, response, condition, API, and variable cards with clear end conditions." },
          { section: "Training", title: "Train the saved configuration", description: "Save all assets, request training, and verify processing and success in the training history." },
          { section: "Bot Test", title: "Check questions and analysis data", description: "Test representative and boundary expressions and inspect the selected intent, stage, cards, variables, and final response." },
          { section: "Improve", title: "Improve through evaluation and retraining", description: "Correct misclassifications and low scores, retrain failed real conversations, then rerun the same test set." },
        ],
      },
    },
    previous: "Previous", next: "Next", finish: "End tour", finished: "Tour complete.", switchCourse: "View another tour", progress: "{current} / {total}",
  },
  "zh-CN": {
    courses: {
      explore: {
        description: "依次查看 Bot、API、Admin 和机器人运营画面。",
        steps: [
          { section: "Bot", title: "创建并管理机器人", description: "在 Bot 菜单确认机器人类型和状态，然后选择要操作的机器人。CGA 当前以独立机器人为中心运营。" },
          { section: "API", title: "连接外部业务系统", description: "注册对话中调用的外部 API 和方法，并配置各机器人版本可使用的连接。" },
          { section: "Admin", title: "管理用户和运营状态", description: "管理用户、组、渠道和模板，并查看对话、Queue、训练、API 与系统状态历史。" },
          { section: "机器人配置", title: "管理意图和训练语句", description: "定义用户话语对应的业务意图，并登记贴近实际表达的训练语句。" },
          { section: "机器人配置", title: "提取关键信息", description: "使用实体提取日期、地区、商品等值，并通过词典统一管理同义词。" },
          { section: "评估", title: "评估分类质量", description: "使用评估数据验证结果，并确认误分类、低分语句和相似意图冲突。" },
          { section: "再训练", title: "将已审核对话用于再训练", description: "选择需要纠正的话语，指定正确意图或知识，仅将审核后的数据用于再训练。" },
          { section: "分析", title: "分析对话量和响应结果", description: "按期间和渠道查看对话量、响应率、分类方式和未响应情况。" },
        ],
      },
      create: {
        description: "从创建机器人到训练和机器人测试验证逐步操作。",
        steps: [
          { section: "创建机器人", title: "输入机器人基本信息", description: "指定类型、头像、名称、说明和语言。创建后由 CGA 分配 UUID。" },
          { section: "引擎选择", title: "选择意图识别方式", description: "训练语句分类使用 ML，语义相似搜索使用 Semantic，生成式意图解释使用 LLM Engine。" },
          { section: "引擎选择", title: "确认模型和回答方式", description: "确认 NLU 模型与固定回答、Semantic RAG、LLM RAG 或 LLM 回答的受支持组合。" },
          { section: "意图登记", title: "创建意图和训练语句", description: "每个意图只包含一个业务目的，并登记同义表达、语序变化和真实用户语句。" },
          { section: "对话设计", title: "配置实体、词典和流程", description: "定义提取值，并连接 Start、回答、条件、API、变量卡片和结束条件。" },
          { section: "训练", title: "训练已保存的配置", description: "保存全部资产后请求训练，并在训练历史中确认处理状态和成功结果。" },
          { section: "机器人测试", title: "确认问题与分析数据", description: "输入代表性及边界表达，检查所选意图、阶段、卡片、变量和最终回答。" },
          { section: "质量改进", title: "通过评估和再训练持续改进", description: "修正误分类和低分结果，再训练实际对话中的失败语句，并使用同一测试集复测。" },
        ],
      },
    },
    previous: "上一步", next: "下一步", finish: "结束体验", finished: "体验已完成。", switchCourse: "查看其他流程", progress: "{current} / {total}",
  },
  ja: {
    courses: {
      explore: {
        description: "Bot・API・Adminとボット運用画面を順番に確認します。",
        steps: [
          { section: "Bot", title: "ボットを作成・管理する", description: "Botメニューで種類と状態を確認し、作業するボットを選択します。CGAは現在、個別ボットを中心に運用します。" },
          { section: "API", title: "外部業務システムを接続する", description: "対話中に呼び出す外部APIとメソッドを登録し、各ボットバージョンで使用する接続を構成します。" },
          { section: "Admin", title: "ユーザーと運用状況を管理する", description: "ユーザー・グループ・チャネル・テンプレートを管理し、対話・Queue・学習・API・システム状態を確認します。" },
          { section: "ボット構成", title: "意図と学習文を管理する", description: "ユーザー発話を業務意図に分類する基準を作り、実際の表現を反映した学習文を登録します。" },
          { section: "ボット構成", title: "重要な情報を抽出する", description: "エンティティで日付や商品などを抽出し、辞書で同義語を一貫して管理します。" },
          { section: "評価", title: "分類品質を評価する", description: "評価データで結果を検証し、誤分類・低スコア・類似意図の衝突を確認します。" },
          { section: "再学習", title: "確認済み対話を再学習する", description: "修正する発話を選び、正しい意図または知識を指定し、確認済みデータだけを反映します。" },
          { section: "分析", title: "対話量と応答結果を分析する", description: "期間・チャネル別の対話量、応答率、分類方式、未応答を確認します。" },
        ],
      },
      create: {
        description: "ボット作成から学習、ボットテストまで順に進みます。",
        steps: [
          { section: "ボット作成", title: "基本情報を入力する", description: "種類、プロフィール、名前、説明、言語を指定します。作成後にCGAがUUIDを付与します。" },
          { section: "エンジン", title: "意図認識方式を選択する", description: "学習文分類はML、意味類似検索はSemantic、生成型意図解釈はLLM Engineを選択します。" },
          { section: "エンジン", title: "モデルと回答方式を確認する", description: "NLUモデルと固定回答、Semantic RAG、LLM RAG、LLM回答の対応する組み合わせを確認します。" },
          { section: "意図", title: "意図と学習文を作成する", description: "1意図に1業務目的を設定し、同義表現・語順変化・実際のユーザー文を登録します。" },
          { section: "対話設計", title: "エンティティ・辞書・フローを構成する", description: "抽出値を定義し、Start、回答、条件、API、変数カードと終了条件を接続します。" },
          { section: "学習", title: "保存した構成を学習する", description: "すべてを保存して学習を要求し、学習履歴で処理状態と成功結果を確認します。" },
          { section: "ボットテスト", title: "質問と分析データを確認する", description: "代表表現と境界表現を入力し、選択意図、段階、カード、変数、最終回答を確認します。" },
          { section: "改善", title: "評価と再学習で改善する", description: "誤分類と低スコアを修正し、失敗発話を再学習して同じテストセットで再検証します。" },
        ],
      },
    },
    previous: "前へ", next: "次へ", finish: "体験を終了", finished: "体験が完了しました。", switchCourse: "別のコースを見る", progress: "{current} / {total}",
  },
  vi: {
    courses: {
      explore: {
        description: "Khám phá lần lượt Bot, API, Admin và các màn hình vận hành bot.",
        steps: [
          { section: "Bot", title: "Tạo và quản lý bot", description: "Kiểm tra loại và trạng thái bot, sau đó chọn bot cần thao tác. CGA hiện vận hành chủ yếu theo từng bot riêng lẻ." },
          { section: "API", title: "Kết nối hệ thống nghiệp vụ", description: "Đăng ký API và phương thức bên ngoài được gọi trong hội thoại, rồi cấu hình kết nối cho từng phiên bản bot." },
          { section: "Admin", title: "Quản lý người dùng và vận hành", description: "Quản lý người dùng, nhóm, kênh, mẫu và xem lịch sử hội thoại, Queue, huấn luyện, API cùng trạng thái hệ thống." },
          { section: "Cấu hình bot", title: "Quản lý ý định và câu huấn luyện", description: "Xác định cách ánh xạ phát ngôn vào nghiệp vụ và đăng ký các cách diễn đạt thực tế." },
          { section: "Cấu hình bot", title: "Trích xuất thông tin chính", description: "Dùng thực thể cho ngày, khu vực, sản phẩm và từ điển cho từ đồng nghĩa." },
          { section: "Đánh giá", title: "Đánh giá chất lượng phân loại", description: "Kiểm tra dữ liệu đánh giá, câu phân loại sai, điểm thấp và xung đột ý định tương tự." },
          { section: "Huấn luyện lại", title: "Đưa hội thoại đã duyệt vào huấn luyện", description: "Chọn phát ngôn cần sửa, gán đúng ý định hoặc tri thức và chỉ dùng dữ liệu đã duyệt." },
          { section: "Phân tích", title: "Phân tích hội thoại và phản hồi", description: "Xem lưu lượng, tỷ lệ phản hồi, cách phân loại và trường hợp không trả lời theo thời gian và kênh." },
        ],
      },
      create: {
        description: "Thực hiện từ tạo bot đến huấn luyện và kiểm tra Bot Test.",
        steps: [
          { section: "Tạo bot", title: "Nhập thông tin cơ bản", description: "Chọn loại, hồ sơ, tên, mô tả và ngôn ngữ. CGA cấp UUID sau khi tạo." },
          { section: "Động cơ", title: "Chọn cách nhận diện ý định", description: "Dùng ML để phân loại câu huấn luyện, Semantic để tìm theo nghĩa hoặc LLM Engine để diễn giải sinh." },
          { section: "Động cơ", title: "Xác nhận mô hình và cách trả lời", description: "Chọn tổ hợp được hỗ trợ giữa mô hình NLU và trả lời cố định, Semantic RAG, LLM RAG hoặc LLM." },
          { section: "Ý định", title: "Tạo ý định và câu huấn luyện", description: "Mỗi ý định chỉ có một mục tiêu nghiệp vụ và gồm các cách nói thực tế khác nhau." },
          { section: "Hội thoại", title: "Cấu hình thực thể, từ điển và luồng", description: "Định nghĩa giá trị cần trích xuất và nối các thẻ Start, trả lời, điều kiện, API, biến cùng điều kiện kết thúc." },
          { section: "Huấn luyện", title: "Huấn luyện cấu hình đã lưu", description: "Lưu toàn bộ tài sản, yêu cầu huấn luyện và kiểm tra trạng thái cùng kết quả thành công trong lịch sử." },
          { section: "Bot Test", title: "Kiểm tra câu hỏi và dữ liệu phân tích", description: "Thử câu đại diện và câu biên, rồi kiểm tra ý định, giai đoạn, thẻ, biến và phản hồi cuối." },
          { section: "Cải thiện", title: "Cải thiện bằng đánh giá và huấn luyện lại", description: "Sửa phân loại sai và điểm thấp, huấn luyện lại câu thất bại rồi chạy lại cùng bộ kiểm thử." },
        ],
      },
    },
    previous: "Trước", next: "Tiếp", finish: "Kết thúc", finished: "Đã hoàn tất trải nghiệm.", switchCourse: "Xem quy trình khác", progress: "{current} / {total}",
  },
  fr: {
    courses: {
      explore: {
        description: "Parcourez successivement Bot, API, Admin et les écrans d’exploitation.",
        steps: [
          { section: "Bot", title: "Créer et gérer les bots", description: "Vérifiez le type et l’état des bots, puis sélectionnez celui à traiter. CGA fonctionne actuellement autour de bots individuels." },
          { section: "API", title: "Connecter les systèmes métier", description: "Enregistrez les API et méthodes externes appelées pendant les conversations, puis configurez-les par version." },
          { section: "Admin", title: "Gérer les utilisateurs et l’exploitation", description: "Gérez utilisateurs, groupes, canaux et modèles, puis consultez les historiques de conversation, Queue, entraînement, API et système." },
          { section: "Configuration", title: "Gérer intentions et phrases d’entraînement", description: "Définissez la correspondance entre les messages et les intentions métier avec des formulations réalistes." },
          { section: "Configuration", title: "Extraire les informations clés", description: "Utilisez les entités pour les dates ou produits et les dictionnaires pour les synonymes." },
          { section: "Évaluation", title: "Évaluer la qualité de classification", description: "Contrôlez les erreurs de classement, les scores faibles et les conflits entre intentions similaires." },
          { section: "Réentraînement", title: "Réutiliser les conversations vérifiées", description: "Sélectionnez les messages à corriger, affectez l’intention ou la connaissance correcte et n’entraînez que les données validées." },
          { section: "Analyse", title: "Analyser conversations et réponses", description: "Consultez le volume, le taux de réponse, le mode de classification et les non-réponses par période et canal." },
        ],
      },
      create: {
        description: "Suivez la création du bot jusqu’à l’entraînement et à la vérification Bot Test.",
        steps: [
          { section: "Création", title: "Saisir les informations de base", description: "Choisissez type, profil, nom, description et langue. CGA attribue un UUID après la création." },
          { section: "Moteur", title: "Choisir la reconnaissance d’intention", description: "Utilisez ML pour la classification, Semantic pour la similarité ou LLM Engine pour l’interprétation générative." },
          { section: "Moteur", title: "Confirmer modèle et mode de réponse", description: "Choisissez une combinaison prise en charge entre modèle NLU et réponse fixe, Semantic RAG, LLM RAG ou LLM." },
          { section: "Intention", title: "Créer intentions et phrases d’entraînement", description: "Conservez un seul objectif métier par intention et ajoutez des formulations réelles variées." },
          { section: "Conversation", title: "Configurer entités, dictionnaires et flux", description: "Définissez les valeurs puis reliez Start, réponse, condition, API, variables et conditions de fin." },
          { section: "Entraînement", title: "Entraîner la configuration enregistrée", description: "Enregistrez les ressources, lancez l’entraînement et vérifiez le traitement et le succès dans l’historique." },
          { section: "Bot Test", title: "Vérifier questions et données d’analyse", description: "Testez des formulations représentatives et limites, puis contrôlez intention, étape, cartes, variables et réponse finale." },
          { section: "Amélioration", title: "Améliorer par évaluation et réentraînement", description: "Corrigez erreurs et scores faibles, réentraînez les échecs réels puis relancez le même jeu de tests." },
        ],
      },
    },
    previous: "Précédent", next: "Suivant", finish: "Terminer", finished: "Parcours terminé.", switchCourse: "Voir un autre parcours", progress: "{current} / {total}",
  },
  de: {
    courses: {
      explore: {
        description: "Bot, API, Admin und den Bot-Betrieb nacheinander erkunden.",
        steps: [
          { section: "Bot", title: "Bots erstellen und verwalten", description: "Bot-Typ und Status prüfen und den gewünschten Bot auswählen. CGA arbeitet derzeit mit einzelnen Bots." },
          { section: "API", title: "Externe Geschäftssysteme anbinden", description: "APIs und Methoden für Gespräche registrieren und die Verbindungen je Bot-Version konfigurieren." },
          { section: "Admin", title: "Benutzer und Betrieb verwalten", description: "Benutzer, Gruppen, Kanäle und Vorlagen verwalten sowie Gesprächs-, Queue-, Trainings-, API- und Systemverläufe prüfen." },
          { section: "Bot-Konfiguration", title: "Intents und Trainingssätze verwalten", description: "Die Zuordnung von Äußerungen zu Geschäftsabsichten definieren und realistische Formulierungen erfassen." },
          { section: "Bot-Konfiguration", title: "Schlüsselinformationen extrahieren", description: "Entitäten für Datum oder Produkt und Wörterbücher für Synonyme verwenden." },
          { section: "Bewertung", title: "Klassifikationsqualität bewerten", description: "Fehlklassifikationen, niedrige Scores und Konflikte ähnlicher Intents prüfen." },
          { section: "Nachtraining", title: "Geprüfte Gespräche erneut trainieren", description: "Zu korrigierende Äußerungen auswählen, Intent oder Wissen zuordnen und nur geprüfte Daten übernehmen." },
          { section: "Analyse", title: "Gespräche und Antworten analysieren", description: "Volumen, Antwortquote, Klassifikationsart und unbeantwortete Fälle nach Zeitraum und Kanal prüfen." },
        ],
      },
      create: {
        description: "Bot-Erstellung, Training und Bot-Test schrittweise durchführen.",
        steps: [
          { section: "Bot erstellen", title: "Grunddaten eingeben", description: "Typ, Profil, Name, Beschreibung und Sprache festlegen. CGA vergibt nach Erstellung eine UUID." },
          { section: "Engine", title: "Intent-Erkennung wählen", description: "ML für Trainingssatz-Klassifikation, Semantic für Ähnlichkeit oder LLM Engine für generative Interpretation verwenden." },
          { section: "Engine", title: "Modell und Antwortart bestätigen", description: "Eine unterstützte Kombination aus NLU-Modell und fester, Semantic-RAG-, LLM-RAG- oder LLM-Antwort wählen." },
          { section: "Intent", title: "Intents und Trainingssätze erstellen", description: "Pro Intent ein Geschäftsziel definieren und unterschiedliche reale Formulierungen ergänzen." },
          { section: "Dialog", title: "Entitäten, Wörterbücher und Flows konfigurieren", description: "Werte definieren und Start-, Antwort-, Bedingungs-, API- und Variablenkarten mit Endbedingungen verbinden." },
          { section: "Training", title: "Gespeicherte Konfiguration trainieren", description: "Alle Assets speichern, Training anfordern und Verarbeitung sowie Erfolg im Trainingsverlauf prüfen." },
          { section: "Bot Test", title: "Fragen und Analysedaten prüfen", description: "Repräsentative und grenznahe Formulierungen testen und Intent, Stufe, Karten, Variablen und Antwort kontrollieren." },
          { section: "Verbesserung", title: "Mit Bewertung und Nachtraining verbessern", description: "Fehler und niedrige Scores korrigieren, reale Fehlfälle nachtrainieren und denselben Testsatz erneut ausführen." },
        ],
      },
    },
    previous: "Zurück", next: "Weiter", finish: "Tour beenden", finished: "Tour abgeschlossen.", switchCourse: "Andere Tour anzeigen", progress: "{current} / {total}",
  },
} satisfies Record<SupportedLanguage, GettingStartedCatalog>;
