import type { SupportedLanguage } from "@/lib/language";

export type TemplateRendererType =
  | "text" | "html" | "card" | "table" | "button" | "link-button" | "form" | "carousel"
  | "dtmf" | "form-a-card" | "simple-text" | "quick-reply" | "basic-card" | "list-card";

export type AdminTemplateDefaultCatalog = Record<TemplateRendererType, string>;

export const ADMIN_TEMPLATE_DEFAULT_CATALOGS = {
  ko: {
    text: "기본 텍스트 메시지", html: "HTML 메시지", card: "카드형 메시지", table: "테이블 메시지",
    button: "버튼 메시지", "link-button": "링크 버튼 메시지", form: "Rich Form 메시지", carousel: "캐러셀 메시지",
    dtmf: "Voice Bot DTMF 메시지", "form-a-card": "Adaptive Cards 메시지", "simple-text": "카카오 기본 텍스트 메시지",
    "quick-reply": "카카오 빠른 답장 메시지", "basic-card": "카카오 기본 카드 메시지", "list-card": "카카오 목록형 카드 메시지",
  },
  en: {
    text: "Basic text message", html: "HTML message", card: "Card message", table: "Table message",
    button: "Button message", "link-button": "Link button message", form: "Rich Form message", carousel: "Carousel message",
    dtmf: "Voice Bot DTMF message", "form-a-card": "Adaptive Cards message", "simple-text": "Kakao basic text message",
    "quick-reply": "Kakao quick reply message", "basic-card": "Kakao basic card message", "list-card": "Kakao list card message",
  },
  "zh-CN": {
    text: "基本文本消息", html: "HTML 消息", card: "卡片消息", table: "表格消息",
    button: "按钮消息", "link-button": "链接按钮消息", form: "Rich Form 消息", carousel: "轮播消息",
    dtmf: "语音机器人 DTMF 消息", "form-a-card": "Adaptive Cards 消息", "simple-text": "Kakao 基本文本消息",
    "quick-reply": "Kakao 快速回复消息", "basic-card": "Kakao 基本卡片消息", "list-card": "Kakao 列表卡片消息",
  },
  ja: {
    text: "基本テキストメッセージ", html: "HTMLメッセージ", card: "カードメッセージ", table: "テーブルメッセージ",
    button: "ボタンメッセージ", "link-button": "リンクボタンメッセージ", form: "Rich Formメッセージ", carousel: "カルーセルメッセージ",
    dtmf: "Voice Bot DTMFメッセージ", "form-a-card": "Adaptive Cardsメッセージ", "simple-text": "Kakao基本テキストメッセージ",
    "quick-reply": "Kakaoクイック返信メッセージ", "basic-card": "Kakao基本カードメッセージ", "list-card": "Kakaoリストカードメッセージ",
  },
  vi: {
    text: "Tin nhắn văn bản cơ bản", html: "Tin nhắn HTML", card: "Tin nhắn thẻ", table: "Tin nhắn bảng",
    button: "Tin nhắn nút", "link-button": "Tin nhắn nút liên kết", form: "Tin nhắn Rich Form", carousel: "Tin nhắn carousel",
    dtmf: "Tin nhắn Voice Bot DTMF", "form-a-card": "Tin nhắn Adaptive Cards", "simple-text": "Tin nhắn văn bản cơ bản Kakao",
    "quick-reply": "Tin nhắn trả lời nhanh Kakao", "basic-card": "Tin nhắn thẻ cơ bản Kakao", "list-card": "Tin nhắn thẻ danh sách Kakao",
  },
  fr: {
    text: "Message texte simple", html: "Message HTML", card: "Message carte", table: "Message tableau",
    button: "Message bouton", "link-button": "Message bouton-lien", form: "Message Rich Form", carousel: "Message carrousel",
    dtmf: "Message Voice Bot DTMF", "form-a-card": "Message Adaptive Cards", "simple-text": "Message texte simple Kakao",
    "quick-reply": "Message de réponse rapide Kakao", "basic-card": "Message carte simple Kakao", "list-card": "Message carte-liste Kakao",
  },
  de: {
    text: "Einfache Textnachricht", html: "HTML-Nachricht", card: "Kartennachricht", table: "Tabellennachricht",
    button: "Schaltflächennachricht", "link-button": "Link-Schaltflächennachricht", form: "Rich-Form-Nachricht", carousel: "Karussellnachricht",
    dtmf: "Voice-Bot-DTMF-Nachricht", "form-a-card": "Adaptive-Cards-Nachricht", "simple-text": "Einfache Kakao-Textnachricht",
    "quick-reply": "Kakao-Schnellantwort", "basic-card": "Einfache Kakao-Kartennachricht", "list-card": "Kakao-Listenkartennachricht",
  },
} satisfies Record<SupportedLanguage, AdminTemplateDefaultCatalog>;
