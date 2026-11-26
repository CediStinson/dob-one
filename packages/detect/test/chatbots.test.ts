import { describe, expect, it } from "vitest";
import { CHATBOT_SIGNATURES, detectChatbots, urlKey } from "../src/index.ts";

/** Echte Einbau-URLs aus den Anleitungen der Anbieter (Stand 11/2026). */
const REAL: Record<string, string> = {
  chatbase: "https://www.chatbase.co/embed.min.js",
  botpress: "https://cdn.botpress.cloud/webchat/v2.2/inject.js",
  voiceflow: "https://cdn.voiceflow.com/widget-next/bundle.mjs",
  intercom: "https://widget.intercom.io/widget/abc123",
  tidio: "https://code.tidio.co/abcdefghijklmnop.js",
  zendesk: "https://static.zdassets.com/ekr/snippet.js?key=abc",
  crisp: "https://client.crisp.chat/l.js",
  tawk: "https://embed.tawk.to/5f00/default",
  livechat: "https://cdn.livechatinc.com/tracking.js",
  drift: "https://js.driftt.com/include/1700000000/abc.js",
  "hubspot-chat": "https://js.usemessages.com/conversations-embed.js",
  "wp-ai-engine": "https://kunde.de/wp-content/plugins/ai-engine/app/chatbot.js?ver=2.1",
  userlike: "https://userlike-cdn-widgets.s3-eu-west-1.amazonaws.com/abc.js",
};

describe("detectChatbots", () => {
  it("erkennt echte Einbau-URLs", () => {
    for (const [id, url] of Object.entries(REAL)) {
      expect(
        detectChatbots([url]).map((f) => f.id),
        url,
      ).toEqual([id]);
    }
  });

  it("ein Treffer pro Anbieter, Reihenfolge der Liste", () => {
    const r = detectChatbots([
      REAL.tidio!,
      "https://widget.intercom.io/widget/x",
      "https://js.intercomcdn.com/frame.js",
      REAL.chatbase!,
    ]);
    expect(r.map((f) => f.id)).toEqual(["chatbase", "intercom", "tidio"]);
    expect(r.find((f) => f.id === "intercom")?.url).toBe("https://widget.intercom.io/widget/x");
  });

  it("kind: KI-Bot vs. Live-Chat mit optionaler KI", () => {
    const r = detectChatbots([REAL.chatbase!, REAL.crisp!]);
    expect(r.map((f) => f.kind)).toEqual(["ai", "ai_optional"]);
  });

  it("keine Fehlalarme bei ähnlichen Namen", () => {
    expect(
      detectChatbots([
        "https://example.de/js/chatbase-clone.js",
        "https://notchatbase.co/x.js",
        "https://www.googletagmanager.com/gtag/js?id=G-1",
        "https://js.hs-scripts.com/123.js",
        "https://maps.example/embed",
        "https://beispiel.de/?q=widget.intercom.io/",
        "https://kunde.de/wp-content/plugins/chatbot-lite/x.js",
        "/relativ/tidio.co/x.js",
        "javascript:void(0)",
      ]),
    ).toEqual([]);
  });

  it("protokollrelative URLs", () => {
    expect(detectChatbots(["//code.tidio.co/abc.js"]).map((f) => f.id)).toEqual(["tidio"]);
  });

  it("urlKey ohne www., Query und Groß/Klein", () => {
    expect(urlKey("https://WWW.Chatbase.co/Embed.min.js?x=1")).toBe("chatbase.co/embed.min.js");
    expect(urlKey("ftp://a.de/x")).toBeNull();
  });

  it("Signaturliste: eindeutige ids, keine Gedankenstriche in Namen", () => {
    const ids = CHATBOT_SIGNATURES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of CHATBOT_SIGNATURES) expect(s.name).not.toMatch(/[–—]/);
  });
});
