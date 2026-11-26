import type { RawMetadata } from "./containers/types.ts";

/** Erkennt Generator-Parameter in PNG-Textchunks (Stable-Diffusion-Oberflächen u. a.). */
export function matchPngText(entry: RawMetadata["text"][number]): string | undefined {
  const k = entry.keyword.toLowerCase();
  const v = entry.value;
  if (k === "parameters" && (/\bSteps:\s*\d/.test(v) || entry.compressed)) {
    return /fooocus/i.test(v) ? "Fooocus" : "Stable Diffusion (AUTOMATIC1111/Forge)";
  }
  if ((k === "prompt" || k === "workflow") && (/class_type|"nodes"/.test(v) || entry.compressed)) {
    return "ComfyUI";
  }
  if (k === "invokeai_metadata" || k === "invokeai_graph" || k === "sd-metadata" || k === "dream") {
    return "InvokeAI";
  }
  if (k === "fooocus_scheme") return "Fooocus";
  if (k === "comment" && /"(steps|sampler|uc)"/.test(v) && /"(prompt|seed)"/.test(v)) {
    return "NovelAI";
  }
  return undefined;
}
