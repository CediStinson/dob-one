export { detect, type DetectResult, type Finding, type Meaning, type Verdict } from "./detect.ts";
export { sniffFormat, type ImageFormat } from "./format.ts";
export { matchGenerator } from "./generators.ts";
export { classifySourceType } from "./iptc.ts";
export {
  buildXmp,
  embedXmpJpeg,
  embedXmpPng,
  embedXmpWebp,
  type EmbedSourceType,
} from "./embed.ts";
