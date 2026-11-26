/** Rohdaten, die ein Container-Parser aus einer Bilddatei herauszieht. */
export interface RawMetadata {
  /** TIFF-Strukturen (EXIF), beginnend mit "II" oder "MM". */
  exif: Uint8Array[];
  /** XMP-Pakete als Text. */
  xmp: string[];
  /** JUMBF-Daten (C2PA-Manifeste), zusammengesetzt. */
  jumbf: Uint8Array[];
  /** PNG-Textchunks (tEXt, iTXt; bei komprimierten Chunks nur das Keyword, value leer). */
  text: { keyword: string; value: string; compressed: boolean }[];
}

export const emptyRaw = (): RawMetadata => ({ exif: [], xmp: [], jumbf: [], text: [] });
