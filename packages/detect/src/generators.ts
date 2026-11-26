/** Bekannte KI-Bildgeneratoren. Geprüft werden nur Software-/Tool-Felder, nicht Bildbeschreibungen. */
const GENERATORS: [name: string, pattern: RegExp][] = [
  ["Midjourney", /midjourney/i],
  ["DALL-E", /dall[·\-\s]?e/i],
  ["ChatGPT / OpenAI", /\bopenai\b|chatgpt|gpt-4o|gpt-image|\bsora\b/i],
  ["Adobe Firefly", /firefly/i],
  ["Stable Diffusion", /stable[\s-]?diffusion|\bsdxl\b|stability\.?ai/i],
  ["ComfyUI", /comfyui/i],
  ["AUTOMATIC1111", /automatic1111|\ba1111\b/i],
  ["InvokeAI", /invoke\s?ai/i],
  ["Fooocus", /fooocus/i],
  ["NovelAI", /novelai/i],
  ["Leonardo.Ai", /leonardo\.?ai/i],
  ["Ideogram", /ideogram/i],
  ["FLUX", /\bflux(\.1|\.2)?\b|black forest labs/i],
  ["Google Gemini / Imagen", /gemini|\bimagen\b|nano banana|made with google ai/i],
  ["Microsoft Designer / Bing", /bing image creator|microsoft designer|copilot designer/i],
  ["Meta AI", /\bmeta ai\b|imagine with meta/i],
  ["Grok", /\bgrok\b/i],
  ["Runway", /runwayml|runway gen/i],
  ["Krea", /krea\.?ai/i],
  ["Playground", /playground\s?(ai|v\d)/i],
  ["DreamStudio", /dreamstudio/i],
  ["Recraft", /recraft/i],
  ["Freepik AI", /freepik\s?(ai|pikaso|mystic)/i],
];

/** Gibt den Namen des erkannten Generators zurück oder undefined. */
export function matchGenerator(value: string): string | undefined {
  for (const [name, pattern] of GENERATORS) if (pattern.test(value)) return name;
  return undefined;
}
