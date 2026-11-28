<?php
/**
 * Writes the IPTC DigitalSourceType (as XMP) into JPEG, PNG or WebP bytes.
 * Port of packages/detect/src/embed.ts, extended: an existing XMP packet is kept and only
 * gets the source type (other data such as copyright stays), instead of a second packet.
 *
 * @package Klarbild
 */

namespace Klarbild\Embed;

use Klarbild\Detect\Bytes;
use Klarbild\Detect\Containers;
use Klarbild\Detect\Detector;

if (!defined('ABSPATH')) {
    exit;
}

final class Embedder
{
    public const IPTC_BASE = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
    public const GENERATED = 'trainedAlgorithmicMedia';
    public const COMPOSITE = 'compositeWithTrainedAlgorithmicMedia';

    private const NS = 'http://iptc.org/std/Iptc4xmpExt/2008-02-29/';
    private const XMP_JPEG_HEADER = "http://ns.adobe.com/xap/1.0/\0";
    private const PNG_XMP_KEYWORD = 'XML:com.adobe.xmp';

    /** Status "ai" / "ai_partial" to source type code, null for anything else. */
    public static function sourceTypeFor(?string $status): ?string
    {
        if ($status === 'ai') {
            return self::GENERATED;
        }
        if ($status === 'ai_partial') {
            return self::COMPOSITE;
        }
        return null;
    }

    /** Minimal packet, same as buildXmp() in embed.ts. */
    public static function buildXmp(string $sourceType): string
    {
        return implode("\n", [
            '<?xpacket begin="' . "\u{FEFF}" . '" id="W5M0MpCehiHzreSzNTczkc9d"?>',
            '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
            '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
            '<rdf:Description rdf:about=""',
            ' xmlns:Iptc4xmpExt="' . self::NS . '"',
            ' Iptc4xmpExt:DigitalSourceType="' . self::IPTC_BASE . $sourceType . '"/>',
            '</rdf:RDF>',
            '</x:xmpmeta>',
            '<?xpacket end="w"?>',
        ]);
    }

    /**
     * Sets the source type in an existing packet. Returns null if the packet has no rdf:RDF.
     */
    public static function mergeXmp(string $xmp, string $sourceType): ?string
    {
        $url = self::IPTC_BASE . $sourceType;
        $field = 'Iptc4xmpExt:DigitalSourceType';
        $patterns = [
            // Attribute form and rdf:resource form: replace the value.
            '/(' . $field . '\s*=\s*)(["\'])[^"\']*\2/',
            '/(<' . $field . '\s[^>]*rdf:resource\s*=\s*)(["\'])[^"\']*\2/',
        ];
        foreach ($patterns as $p) {
            if (preg_match($p, $xmp) === 1) {
                return (string) preg_replace_callback($p, static function (array $m) use ($url): string {
                    return $m[1] . $m[2] . $url . $m[2];
                }, $xmp, 1);
            }
        }
        $element = '/<' . $field . '(\s[^>]*)?>[\s\S]*?<\/' . $field . '>/';
        if (preg_match($element, $xmp) === 1) {
            return (string) preg_replace_callback($element, static function () use ($field, $url): string {
                return '<' . $field . '>' . $url . '</' . $field . '>';
            }, $xmp, 1);
        }
        // Own rdf:Description: the namespace is declared there, so it never clashes with others.
        if (preg_match('/<rdf:RDF\b[^>]*>/', $xmp, $m, PREG_OFFSET_CAPTURE) !== 1) {
            return null;
        }
        $at = $m[0][1] + strlen($m[0][0]);
        $description = "\n" . '<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="' . self::NS . '" '
            . $field . '="' . $url . '"/>';
        return substr($xmp, 0, $at) . $description . substr($xmp, $at);
    }

    /**
     * Returns new bytes with the source type, or null if the format is not supported or the
     * result would not be recognised (then nothing should be written).
     */
    public static function embed(string $bytes, string $sourceType): ?string
    {
        if (!in_array($sourceType, [self::GENERATED, self::COMPOSITE], true)) {
            return null;
        }
        $format = Containers::sniff($bytes);
        if ($format === 'jpeg') {
            $out = self::jpeg($bytes, $sourceType);
        } elseif ($format === 'png') {
            $out = self::png($bytes, $sourceType);
        } elseif ($format === 'webp') {
            $out = self::webp($bytes, $sourceType);
        } else {
            return null;
        }
        return $out !== null && self::hasSourceType($out, $sourceType) ? $out : null;
    }

    /** True if the bytes already carry exactly this source type in XMP. */
    public static function hasSourceType(string $bytes, string $sourceType): bool
    {
        foreach (Detector::detect($bytes)['findings'] as $f) {
            if ($f['source'] === 'xmp' && $f['field'] === 'Iptc4xmpExt:DigitalSourceType' && $f['value'] === $sourceType) {
                return true;
            }
        }
        return false;
    }

    private static function jpeg(string $b, string $sourceType): ?string
    {
        if (substr($b, 0, 2) !== "\xFF\xD8") {
            return null;
        }
        // Look for an existing XMP APP1 segment before the image data.
        $len = strlen($b);
        $o = 2;
        $complete = false;
        while ($o + 4 <= $len && $b[$o] === "\xFF") {
            $marker = ord($b[$o + 1]);
            if ($marker === 0xDA) {
                $complete = true; // start of image data reached: the header is intact
                break;
            }
            if ($marker === 0xD9) {
                break;
            }
            if ($marker === 0xFF || $marker === 0x01 || ($marker >= 0xD0 && $marker <= 0xD7)) {
                $o += $marker === 0xFF ? 1 : 2;
                continue;
            }
            $segLen = Bytes::u16be($b, $o + 2);
            if ($segLen < 2 || $o + 2 + $segLen > $len) {
                return null;
            }
            if ($marker === 0xE1 && Bytes::startsWith($b, $o + 4, self::XMP_JPEG_HEADER)) {
                $start = $o + 4 + strlen(self::XMP_JPEG_HEADER);
                $packet = Bytes::utf8(substr($b, $start, $o + 2 + $segLen - $start));
                $merged = self::mergeXmp($packet, $sourceType);
                if ($merged === null) {
                    return null;
                }
                $segment = self::jpegSegment($merged);
                return $segment === null ? null : substr($b, 0, $o) . $segment . substr($b, $o + 2 + $segLen);
            }
            $o += 2 + $segLen;
        }
        if (!$complete) {
            return null;
        }
        $segment = self::jpegSegment(self::buildXmp($sourceType));
        $at = 2;
        if (substr($b, 2, 2) === "\xFF\xE0") {
            $at = 4 + Bytes::u16be($b, 4);
        }
        return substr($b, 0, $at) . $segment . substr($b, $at);
    }

    private static function jpegSegment(string $xmp): ?string
    {
        $payload = self::XMP_JPEG_HEADER . $xmp;
        $len = strlen($payload) + 2;
        if ($len > 0xFFFF) {
            return null; // Extended XMP is not supported; leave the file alone.
        }
        return "\xFF\xE1" . chr($len >> 8) . chr($len & 0xFF) . $payload;
    }

    private static function png(string $b, string $sourceType): ?string
    {
        if (substr($b, 0, 8) !== "\x89PNG\r\n\x1A\n" || substr($b, 12, 4) !== 'IHDR') {
            return null;
        }
        $len = strlen($b);
        $o = 8;
        $complete = false;
        while ($o + 12 <= $len) {
            $chunkLen = Bytes::u32be($b, $o);
            $type = substr($b, $o + 4, 4);
            if ($chunkLen < 0 || $o + 12 + $chunkLen > $len) {
                return null;
            }
            if ($type === 'iTXt' && substr($b, $o + 8, strlen(self::PNG_XMP_KEYWORD) + 1) === self::PNG_XMP_KEYWORD . "\0") {
                $data = substr($b, $o + 8, $chunkLen);
                if (($data[strlen(self::PNG_XMP_KEYWORD) + 1] ?? '') === "\x01") {
                    return null; // compressed XMP: not touched
                }
                $p = strlen(self::PNG_XMP_KEYWORD) + 3;
                for ($i = 0; $i < 2; $i++) {
                    $end = $p <= strlen($data) ? strpos($data, "\0", $p) : false;
                    if ($end === false) {
                        return null;
                    }
                    $p = $end + 1;
                }
                $merged = self::mergeXmp(Bytes::utf8(substr($data, $p)), $sourceType);
                if ($merged === null) {
                    return null;
                }
                return substr($b, 0, $o) . self::pngChunk($merged) . substr($b, $o + 12 + $chunkLen);
            }
            if ($type === 'IEND') {
                $complete = true;
                break;
            }
            $o += 12 + $chunkLen;
        }
        if (!$complete) {
            return null; // truncated file: leave it alone
        }
        $ihdrEnd = 8 + 12 + Bytes::u32be($b, 8);
        return substr($b, 0, $ihdrEnd) . self::pngChunk(self::buildXmp($sourceType)) . substr($b, $ihdrEnd);
    }

    private static function pngChunk(string $xmp): string
    {
        // keyword \0 compressionFlag compressionMethod lang \0 translated \0 text
        $data = self::PNG_XMP_KEYWORD . "\0\0\0\0\0" . $xmp;
        $typeAndData = 'iTXt' . $data;
        return pack('N', strlen($data)) . $typeAndData . pack('N', crc32($typeAndData));
    }

    private static function webp(string $b, string $sourceType): ?string
    {
        if (substr($b, 0, 4) !== 'RIFF' || substr($b, 8, 4) !== 'WEBP') {
            return null;
        }
        $chunks = [];
        $len = strlen($b);
        $o = 12;
        while ($o + 8 <= $len) {
            $type = substr($b, $o, 4);
            $chunkLen = Bytes::u32le($b, $o + 4);
            if ($chunkLen < 0 || $o + 8 + $chunkLen > $len) {
                return null;
            }
            $chunks[] = [$type, substr($b, $o + 8, $chunkLen)];
            $o += 8 + $chunkLen + ($chunkLen % 2);
        }
        if (count($chunks) === 0) {
            return null;
        }

        $xmp = null;
        foreach ($chunks as $i => [$type, $data]) {
            if ($type === 'XMP ') {
                $xmp = self::mergeXmp(Bytes::utf8($data), $sourceType);
                if ($xmp === null) {
                    return null;
                }
                unset($chunks[$i]);
            }
        }
        $chunks = array_values($chunks);
        if ($xmp === null) {
            $xmp = self::buildXmp($sourceType);
        }

        if ($chunks[0][0] === 'VP8X') {
            if (strlen($chunks[0][1]) < 10) {
                return null;
            }
            $chunks[0][1][0] = chr(ord($chunks[0][1][0]) | 0x04);
        } else {
            $size = self::webpSize($chunks[0][0], $chunks[0][1]);
            if ($size === null) {
                return null;
            }
            [$width, $height, $alpha] = $size;
            $vp8x = chr(($alpha ? 0x10 : 0) | 0x04) . "\0\0\0" . self::le24($width - 1) . self::le24($height - 1);
            array_unshift($chunks, ['VP8X', $vp8x]);
        }
        // XMP belongs at the end (after image data, before nothing else we know of).
        $chunks[] = ['XMP ', $xmp];

        $body = 'WEBP';
        foreach ($chunks as [$type, $data]) {
            $body .= $type . pack('V', strlen($data)) . $data . (strlen($data) % 2 ? "\0" : '');
        }
        return 'RIFF' . pack('V', strlen($body)) . $body;
    }

    /**
     * Canvas size from a simple WebP (VP8 or VP8L). [width, height, hasAlpha] or null.
     *
     * @return array{0: int, 1: int, 2: bool}|null
     */
    private static function webpSize(string $type, string $data): ?array
    {
        if ($type === 'VP8 ' && strlen($data) >= 10 && substr($data, 3, 3) === "\x9D\x01\x2A") {
            $w = (ord($data[6]) | (ord($data[7]) << 8)) & 0x3FFF;
            $h = (ord($data[8]) | (ord($data[9]) << 8)) & 0x3FFF;
            return $w > 0 && $h > 0 ? [$w, $h, false] : null;
        }
        if ($type === 'VP8L' && strlen($data) >= 5 && $data[0] === "\x2F") {
            $bits = Bytes::u32le($data, 1);
            $w = ($bits & 0x3FFF) + 1;
            $h = (($bits >> 14) & 0x3FFF) + 1;
            return [$w, $h, (($bits >> 28) & 1) === 1];
        }
        return null;
    }

    private static function le24(int $n): string
    {
        return chr($n & 0xFF) . chr(($n >> 8) & 0xFF) . chr(($n >> 16) & 0xFF);
    }
}
