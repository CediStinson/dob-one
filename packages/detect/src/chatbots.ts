/**
 * Erkennung von Chatbot- und Live-Chat-Widgets anhand von Skript-, iframe- und
 * Snippet-URLs. Kein Laden der Widgets, nur URL-Vergleich (host + Pfad).
 *
 * kind:
 *  - "ai": Produkt ist ein KI-Chatbot.
 *  - "ai_optional": Live-Chat, der optional KI-Antworten geben kann (z. B. Intercom Fin, Tidio Lyro).
 */

export type ChatbotKind = "ai" | "ai_optional";

export interface ChatbotSignature {
  id: string;
  name: string;
  kind: ChatbotKind;
  /** Wird gegen "host/pfad" (klein, ohne Query, ohne www.) geprüft. */
  pattern: RegExp;
}

export interface ChatbotFinding {
  id: string;
  name: string;
  kind: ChatbotKind;
  /** Erste URL, an der das Widget erkannt wurde. */
  url: string;
}

export const CHATBOT_SIGNATURES: readonly ChatbotSignature[] = [
  // KI-Chatbots
  { id: "chatbase", name: "Chatbase", kind: "ai", pattern: /(^|\.)chatbase\.co\// },
  { id: "botpress", name: "Botpress", kind: "ai", pattern: /(^|\.)botpress\.(cloud|com)\// },
  { id: "voiceflow", name: "Voiceflow", kind: "ai", pattern: /(^|\.)voiceflow\.com\// },
  { id: "moinai", name: "moin.ai", kind: "ai", pattern: /(^|\.)moin\.ai\// },
  { id: "customgpt", name: "CustomGPT", kind: "ai", pattern: /(^|\.)customgpt\.ai\// },
  { id: "dante", name: "Dante AI", kind: "ai", pattern: /(^|\.)dante-ai\.com\// },
  { id: "docsbot", name: "DocsBot", kind: "ai", pattern: /(^|\.)docsbot\.ai\// },
  { id: "chatling", name: "Chatling", kind: "ai", pattern: /(^|\.)chatling\.ai\// },
  { id: "kommunicate", name: "Kommunicate", kind: "ai", pattern: /(^|\.)kommunicate\.io\// },
  { id: "ada", name: "Ada", kind: "ai", pattern: /(^|\.)ada\.support\// },
  {
    id: "chatkit",
    name: "OpenAI ChatKit",
    kind: "ai",
    pattern: /(^|\.)platform\.openai\.com\/deployments\/chatkit/,
  },
  {
    id: "copilot-studio",
    name: "Microsoft Copilot Studio",
    kind: "ai",
    pattern: /(^|\.)(copilotstudio|powerva)\.microsoft\.com\/|(^|\.)botframework\.com\//,
  },
  {
    id: "dialogflow",
    name: "Google Dialogflow",
    kind: "ai",
    pattern: /gstatic\.com\/dialogflow-console\/|(^|\.)dialogflow\.cloud\.google\.com\//,
  },
  { id: "flowise", name: "Flowise", kind: "ai", pattern: /flowise-embed|(^|\.)flowiseai\.com\// },
  {
    id: "wp-ai-engine",
    name: "AI Engine (WordPress)",
    kind: "ai",
    pattern: /\/wp-content\/plugins\/ai-engine(-pro)?\//,
  },
  {
    id: "wp-aipower",
    name: "AI Power (WordPress)",
    kind: "ai",
    pattern: /\/wp-content\/plugins\/gpt3-ai-content-generator(-premium)?\//,
  },
  // Live-Chats mit optionaler KI
  {
    id: "intercom",
    name: "Intercom",
    kind: "ai_optional",
    pattern: /(^|\.)widget\.intercom\.io\/|(^|\.)intercomcdn\.com\//,
  },
  { id: "tidio", name: "Tidio", kind: "ai_optional", pattern: /(^|\.)tidio\.co\// },
  {
    id: "zendesk",
    name: "Zendesk",
    kind: "ai_optional",
    pattern: /(^|\.)zdassets\.com\/ekr\/|(^|\.)zopim\.com\//,
  },
  {
    id: "hubspot-chat",
    name: "HubSpot Chat",
    kind: "ai_optional",
    pattern: /(^|\.)usemessages\.com\//,
  },
  { id: "crisp", name: "Crisp", kind: "ai_optional", pattern: /(^|\.)client\.crisp\.chat\// },
  { id: "drift", name: "Drift", kind: "ai_optional", pattern: /(^|\.)driftt\.com\// },
  { id: "tawk", name: "tawk.to", kind: "ai_optional", pattern: /(^|\.)tawk\.to\// },
  { id: "livechat", name: "LiveChat", kind: "ai_optional", pattern: /(^|\.)livechatinc\.com\// },
  { id: "chatbotcom", name: "ChatBot.com", kind: "ai_optional", pattern: /(^|\.)chatbot\.com\// },
  {
    id: "freshchat",
    name: "Freshchat",
    kind: "ai_optional",
    pattern: /(^|\.)freshchat\.com\/js\/|(^|\.)wchat\.freshchat\.com\//,
  },
  {
    id: "userlike",
    name: "Userlike",
    kind: "ai_optional",
    pattern: /(^|\.)userlike\.com\/|^userlike-cdn-widgets\./,
  },
  {
    id: "smartsupp",
    name: "Smartsupp",
    kind: "ai_optional",
    pattern: /(^|\.)smartsupp(chat)?\.com\//,
  },
  {
    id: "zoho-salesiq",
    name: "Zoho SalesIQ",
    kind: "ai_optional",
    pattern: /(^|\.)salesiq\.zoho\./,
  },
  { id: "chatwoot", name: "Chatwoot", kind: "ai_optional", pattern: /(^|\.)app\.chatwoot\.com\// },
  { id: "landbot", name: "Landbot", kind: "ai_optional", pattern: /(^|\.)landbot\.io\// },
  {
    id: "typebot",
    name: "Typebot",
    kind: "ai_optional",
    pattern: /(^|\.)typebot\.io\/|@typebot\.io\//,
  },
  { id: "trengo", name: "Trengo", kind: "ai_optional", pattern: /(^|\.)trengo\.(eu|com)\// },
  {
    id: "superchat",
    name: "Superchat",
    kind: "ai_optional",
    pattern: /(^|\.)superchat\.(de|com)\//,
  },
  {
    id: "brevo",
    name: "Brevo Conversations",
    kind: "ai_optional",
    pattern: /(^|\.)conversations-widget\.(brevo|sendinblue)\.com\//,
  },
  {
    id: "wpbot",
    name: "WPBot (WordPress)",
    kind: "ai_optional",
    pattern: /\/wp-content\/plugins\/chatbot\//,
  },
];

/** "host/pfad" ohne www., klein. Relative oder kaputte URLs werden übersprungen. */
export function urlKey(raw: string): string | null {
  try {
    const u = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Findet bekannte Chat-Widgets. Pro Anbieter ein Treffer, Reihenfolge der Signaturliste. */
export function detectChatbots(urls: Iterable<string>): ChatbotFinding[] {
  const found = new Map<string, ChatbotFinding>();
  for (const raw of urls) {
    const key = urlKey(raw);
    if (!key) continue;
    for (const s of CHATBOT_SIGNATURES) {
      if (!found.has(s.id) && s.pattern.test(key)) {
        found.set(s.id, { id: s.id, name: s.name, kind: s.kind, url: raw });
      }
    }
  }
  return CHATBOT_SIGNATURES.flatMap((s) => {
    const f = found.get(s.id);
    return f ? [f] : [];
  });
}
