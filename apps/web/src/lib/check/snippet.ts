/**
 * Fertiges HTML/CSS-Snippet für einen sichtbaren KI-Hinweis an einem Bild.
 * Ohne externe Ressourcen, ohne JavaScript.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SnippetOptions {
  text: string;
  /** Bild-URL, sonst Platzhalter */
  src?: string;
}

export const SNIPPET_CSS = `.ki-hinweis{position:relative;display:inline-block;margin:0}
.ki-hinweis img{display:block;max-width:100%;height:auto}
.ki-hinweis figcaption{position:absolute;right:8px;bottom:8px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.9);color:#1b2a33;font:600 12px/1.6 system-ui,sans-serif}`;

export function labelSnippet({ text, src }: SnippetOptions): string {
  const label = escapeHtml(text.trim().slice(0, 60) || "KI-generiert");
  const url = escapeHtml(src ?? "IHR-BILD.jpg");
  return `<figure class="ki-hinweis">
  <img src="${url}" alt="BILDBESCHREIBUNG">
  <figcaption>${label}</figcaption>
</figure>
<style>
${SNIPPET_CSS}
</style>`;
}
