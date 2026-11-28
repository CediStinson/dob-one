<?php
/**
 * Byte and text helpers. PHP strings are byte strings; all text handed out is valid UTF-8.
 * Behaviour mirrors packages/detect/src/bytes.ts (TextDecoder, String.prototype.trim).
 *
 * @package Klarbild
 */

namespace Klarbild\Detect;

if (!defined('ABSPATH')) {
    exit;
}

final class Bytes
{
    /** Big-endian uint16 at $o, -1 if out of range. */
    public static function u16be(string $b, int $o): int
    {
        return $o >= 0 && $o + 1 < strlen($b) ? (ord($b[$o]) << 8) | ord($b[$o + 1]) : -1;
    }

    public static function u32be(string $b, int $o): int
    {
        if ($o < 0 || $o + 3 >= strlen($b)) {
            return -1;
        }
        return (ord($b[$o]) << 24) | (ord($b[$o + 1]) << 16) | (ord($b[$o + 2]) << 8) | ord($b[$o + 3]);
    }

    public static function u32le(string $b, int $o): int
    {
        if ($o < 0 || $o + 3 >= strlen($b)) {
            return -1;
        }
        return ord($b[$o]) | (ord($b[$o + 1]) << 8) | (ord($b[$o + 2]) << 16) | (ord($b[$o + 3]) << 24);
    }

    /** Like Uint8Array.subarray: clamps, never fails. */
    public static function sub(string $b, int $start, ?int $end = null): string
    {
        $len = strlen($b);
        $end = $end === null ? $len : min($len, $end);
        $start = max(0, min($len, $start));
        return $end > $start ? substr($b, $start, $end - $start) : '';
    }

    public static function startsWith(string $b, int $offset, string $text): bool
    {
        return self::sub($b, $offset, $offset + strlen($text)) === $text;
    }

    /** Latin-1 bytes to UTF-8 (each byte one character). */
    public static function latin1(string $b): string
    {
        return (string) preg_replace_callback('/[\x80-\xFF]/', static function (array $m): string {
            $c = ord($m[0]);
            return chr(0xC0 | ($c >> 6)) . chr(0x80 | ($c & 0x3F));
        }, $b);
    }

    /** UTF-8 decoding with U+FFFD for invalid sequences (like TextDecoder). */
    public static function utf8(string $b): string
    {
        if (preg_match('//u', $b) === 1) {
            return $b;
        }
        $valid = '/\G(?:[\x00-\x7F]|[\xC2-\xDF][\x80-\xBF]|\xE0[\xA0-\xBF][\x80-\xBF]|[\xE1-\xEC\xEE\xEF][\x80-\xBF]{2}'
            . '|\xED[\x80-\x9F][\x80-\xBF]|\xF0[\x90-\xBF][\x80-\xBF]{2}|[\xF1-\xF3][\x80-\xBF]{3}|\xF4[\x80-\x8F][\x80-\xBF]{2})+/';
        $out = '';
        $pos = 0;
        $len = strlen($b);
        while ($pos < $len) {
            if (preg_match($valid, $b, $m, 0, $pos) === 1) {
                $out .= $m[0];
                $pos += strlen($m[0]);
                continue;
            }
            $out .= "\u{FFFD}";
            $pos++;
        }
        return $out;
    }

    /** String.prototype.trim on UTF-8 text. */
    public static function trim(string $s): string
    {
        $ws = '[\s\x{00A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]';
        $r = preg_replace('/^' . $ws . '+|' . $ws . '+$/u', '', $s);
        return $r === null ? trim($s) : $r;
    }

    /** First $n characters of UTF-8 text. */
    public static function head(string $s, int $n): string
    {
        return preg_match('/^.{0,' . $n . '}/su', $s, $m) === 1 ? $m[0] : substr($s, 0, $n);
    }
}
