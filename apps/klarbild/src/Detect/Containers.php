<?php
/**
 * Pulls raw metadata out of JPEG, PNG and WebP. Port of packages/detect/src/containers/*.ts.
 * Tolerates truncated data: reads only what is there, never throws.
 *
 * Raw shape: ['exif' => string[] (TIFF bytes), 'xmp' => string[] (UTF-8), 'jumbf' => string[] (bytes),
 *             'text' => list<array{keyword: string, value: string, compressed: bool}>]
 *
 * @package Klarbild
 */

namespace Klarbild\Detect;

if (!defined('ABSPATH')) {
    exit;
}

final class Containers
{
    private const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";

    /**
     * @return array{exif: string[], xmp: string[], jumbf: string[], text: list<array{keyword: string, value: string, compressed: bool}>}
     */
    public static function emptyRaw(): array
    {
        return ['exif' => [], 'xmp' => [], 'jumbf' => [], 'text' => []];
    }

    public static function sniff(string $b): string
    {
        $len = strlen($b);
        if ($len >= 3 && $b[0] === "\xFF" && $b[1] === "\xD8" && $b[2] === "\xFF") {
            return 'jpeg';
        }
        if ($len >= 8 && $b[0] === "\x89" && substr($b, 1, 3) === 'PNG') {
            return 'png';
        }
        if ($len >= 12 && substr($b, 0, 4) === 'RIFF' && substr($b, 8, 4) === 'WEBP') {
            return 'webp';
        }
        if ($len >= 6 && substr($b, 0, 3) === 'GIF') {
            return 'gif';
        }
        if ($len >= 12 && substr($b, 4, 4) === 'ftyp') {
            $brand = substr($b, 8, 4);
            if ($brand === 'avif' || $brand === 'avis') {
                return 'avif';
            }
        }
        return 'unknown';
    }

    /** APP1 (EXIF, XMP) and APP11 (JUMBF/C2PA). */
    public static function jpeg(string $b): array
    {
        $raw = self::emptyRaw();
        $parts = [];
        $len = strlen($b);
        $o = 2;
        while ($o + 4 <= $len) {
            if ($b[$o] !== "\xFF") {
                break;
            }
            $marker = ord($b[$o + 1]);
            if ($marker === 0xFF) {
                $o++;
                continue;
            }
            if ($marker === 0xD9 || $marker === 0xDA) {
                break;
            }
            if ($marker === 0x01 || ($marker >= 0xD0 && $marker <= 0xD7)) {
                $o += 2;
                continue;
            }
            $segLen = Bytes::u16be($b, $o + 2);
            if ($segLen < 2) {
                break;
            }
            $payload = Bytes::sub($b, $o + 4, $o + 2 + $segLen);
            if ($marker === 0xE1) {
                if (Bytes::startsWith($payload, 0, "Exif\0\0")) {
                    $raw['exif'][] = Bytes::sub($payload, 6);
                } elseif (Bytes::startsWith($payload, 0, self::XMP_HEADER)) {
                    $raw['xmp'][] = Bytes::utf8(Bytes::sub($payload, strlen(self::XMP_HEADER)));
                }
            } elseif ($marker === 0xEB && Bytes::startsWith($payload, 0, 'JP')) {
                // JPEG XT: "JP", box instance (2), sequence (4), then JUMBF. Later segments repeat LBox/TBox.
                $instance = Bytes::u16be($payload, 2);
                $seq = Bytes::u32be($payload, 4);
                $first = !isset($parts[$instance]) || count($parts[$instance]) === 0;
                $parts[$instance][] = Bytes::sub($payload, $seq <= 1 || $first ? 8 : 16);
            }
            $o += 2 + $segLen;
        }
        foreach ($parts as $list) {
            $raw['jumbf'][] = implode('', $list);
        }
        return $raw;
    }

    /** tEXt, iTXt, zTXt (keyword only), eXIf and caBX (C2PA). */
    public static function png(string $b): array
    {
        $raw = self::emptyRaw();
        $len = strlen($b);
        $o = 8;
        while ($o + 8 <= $len) {
            $chunkLen = Bytes::u32be($b, $o);
            if ($chunkLen < 0) {
                break;
            }
            $type = Bytes::sub($b, $o + 4, $o + 8);
            $data = Bytes::sub($b, $o + 8, $o + 8 + $chunkLen);
            if ($type === 'tEXt' || $type === 'zTXt') {
                $nul = strpos($data, "\0");
                if ($nul !== false && $nul > 0) {
                    $compressed = $type === 'zTXt';
                    $raw['text'][] = [
                        'keyword' => Bytes::latin1(substr($data, 0, $nul)),
                        'value' => $compressed ? '' : Bytes::latin1(Bytes::sub($data, $nul + 1)),
                        'compressed' => $compressed,
                    ];
                }
            } elseif ($type === 'iTXt') {
                self::itxt($raw, $data);
            } elseif ($type === 'eXIf') {
                $raw['exif'][] = $data;
            } elseif ($type === 'caBX') {
                $raw['jumbf'][] = $data;
            } elseif ($type === 'IEND') {
                break;
            }
            $o += 12 + $chunkLen;
        }
        return $raw;
    }

    private static function itxt(array &$raw, string $data): void
    {
        $nul = strpos($data, "\0");
        if ($nul === false || $nul <= 0) {
            return;
        }
        $keyword = Bytes::latin1(substr($data, 0, $nul));
        $compressed = isset($data[$nul + 1]) && $data[$nul + 1] === "\x01";
        // Then: compression method (1), language\0, translated keyword\0, text.
        $p = $nul + 3;
        for ($i = 0; $i < 2; $i++) {
            $end = $p <= strlen($data) ? strpos($data, "\0", $p) : false;
            if ($end === false) {
                return;
            }
            $p = $end + 1;
        }
        $value = $compressed ? '' : Bytes::utf8(Bytes::sub($data, $p));
        if ($keyword === 'XML:com.adobe.xmp' && $value !== '') {
            $raw['xmp'][] = $value;
        } else {
            $raw['text'][] = ['keyword' => $keyword, 'value' => $value, 'compressed' => $compressed];
        }
    }

    /** RIFF chunks "EXIF", "XMP " and "C2PA". */
    public static function webp(string $b): array
    {
        $raw = self::emptyRaw();
        $len = strlen($b);
        $o = 12;
        while ($o + 8 <= $len) {
            $type = Bytes::sub($b, $o, $o + 4);
            $chunkLen = Bytes::u32le($b, $o + 4);
            if ($chunkLen < 0) {
                break;
            }
            $data = Bytes::sub($b, $o + 8, $o + 8 + $chunkLen);
            if ($type === 'EXIF') {
                $raw['exif'][] = substr($data, 0, 6) === "Exif\0\0" ? Bytes::sub($data, 6) : $data;
            } elseif ($type === 'XMP ') {
                $raw['xmp'][] = Bytes::utf8($data);
            } elseif ($type === 'C2PA') {
                $raw['jumbf'][] = $data;
            }
            $o += 8 + $chunkLen + ($chunkLen % 2);
        }
        return $raw;
    }
}
