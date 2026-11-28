<?php
/**
 * Field readers: EXIF IFD0, XMP, C2PA, IPTC source type, generator names, PNG text.
 * Port of packages/detect/src/{exif,xmp,c2pa,iptc,generators,png-text}.ts.
 *
 * @package Klarbild
 */

namespace Klarbild\Detect;

if (!defined('ABSPATH')) {
    exit;
}

final class Fields
{
    private const EXIF_TAGS = [
        0x010e => 'ImageDescription',
        0x010f => 'Make',
        0x0110 => 'Model',
        0x0131 => 'Software',
        0x013b => 'Artist',
        0x8298 => 'Copyright',
    ];

    public const XMP_FIELDS = [
        'Iptc4xmpExt:DigitalSourceType',
        'xmp:CreatorTool',
        'tiff:Software',
        'photoshop:Credit',
        'dc:creator',
        'dc:description',
        'plus:DataMining',
    ];

    private const AI_CODES = [
        'trainedalgorithmicmedia' => 'ai_generated',
        'compositewithtrainedalgorithmicmedia' => 'ai_composite',
        'algorithmicallyenhanced' => 'ai_edited',
    ];

    /** Byte patterns (no /u): only tool and software fields are checked, never descriptions. */
    private const GENERATORS = [
        ['Midjourney', '/midjourney/i'],
        ['DALL-E', '/dall(?:\xC2\xB7|[\-\s])?e/i'],
        ['ChatGPT / OpenAI', '/\bopenai\b|chatgpt|gpt-4o|gpt-image|\bsora\b/i'],
        ['Adobe Firefly', '/firefly/i'],
        ['Stable Diffusion', '/stable[\s-]?diffusion|\bsdxl\b|stability\.?ai/i'],
        ['ComfyUI', '/comfyui/i'],
        ['AUTOMATIC1111', '/automatic1111|\ba1111\b/i'],
        ['InvokeAI', '/invoke\s?ai/i'],
        ['Fooocus', '/fooocus/i'],
        ['NovelAI', '/novelai/i'],
        ['Leonardo.Ai', '/leonardo\.?ai/i'],
        ['Ideogram', '/ideogram/i'],
        ['FLUX', '/\bflux(\.1|\.2)?\b|black forest labs/i'],
        ['Google Gemini / Imagen', '/gemini|\bimagen\b|nano banana|made with google ai/i'],
        ['Microsoft Designer / Bing', '/bing image creator|microsoft designer|copilot designer/i'],
        ['Meta AI', '/\bmeta ai\b|imagine with meta/i'],
        ['Grok', '/\bgrok\b/i'],
        ['Runway', '/runwayml|runway gen/i'],
        ['Krea', '/krea\.?ai/i'],
        ['Playground', '/playground\s?(ai|v\d)/i'],
        ['DreamStudio', '/dreamstudio/i'],
        ['Recraft', '/recraft/i'],
        ['Freepik AI', '/freepik\s?(ai|pikaso|mystic)/i'],
    ];

    public static function matchGenerator(string $value): ?string
    {
        foreach (self::GENERATORS as [$name, $pattern]) {
            if (preg_match($pattern, $value) === 1) {
                return $name;
            }
        }
        return null;
    }

    /**
     * URL or code ("trainedAlgorithmicMedia") to code + meaning.
     *
     * @return array{code: string, meaning: string}
     */
    public static function classifySourceType(string $value): array
    {
        $parts = array_values(array_filter(
            (array) preg_split('#[/\#]#', Bytes::trim($value)),
            static function ($p) {
                return $p !== '';
            }
        ));
        $code = count($parts) > 0 ? (string) end($parts) : $value;
        $key = strtolower($code);
        return ['code' => $code, 'meaning' => self::AI_CODES[$key] ?? 'not_ai'];
    }

    /** @return string[] */
    public static function findSourceTypeCodes(string $text): array
    {
        preg_match_all('#digitalsourcetype/([A-Za-z]+)#i', $text, $m);
        return array_values(array_unique($m[1]));
    }

    /** ASCII tags from IFD0 of a TIFF structure. Empty array on errors. */
    public static function exif(string $tiff): array
    {
        $out = [];
        $order = Bytes::sub($tiff, 0, 2);
        if ($order !== 'II' && $order !== 'MM') {
            return $out;
        }
        $le = $order === 'II';
        $len = strlen($tiff);
        $u16 = static function (int $o) use ($tiff, $len, $le): int {
            if ($o < 0 || $o + 2 > $len) {
                return -1;
            }
            return $le ? ord($tiff[$o]) | (ord($tiff[$o + 1]) << 8) : (ord($tiff[$o]) << 8) | ord($tiff[$o + 1]);
        };
        $u32 = static function (int $o) use ($tiff, $len, $le): int {
            if ($o < 0 || $o + 4 > $len) {
                return -1;
            }
            return $le ? Bytes::u32le($tiff, $o) : Bytes::u32be($tiff, $o);
        };
        $ifd = $u32(4);
        $count = $u16($ifd);
        if ($ifd < 8 || $count < 0) {
            return $out;
        }
        for ($i = 0; $i < $count && $i < 512; $i++) {
            $entry = $ifd + 2 + $i * 12;
            $tag = $u16($entry);
            $type = $u16($entry + 2);
            $n = $u32($entry + 4);
            $name = self::EXIF_TAGS[$tag] ?? null;
            if ($tag < 0 || $name === null || $type !== 2 || $n <= 0) {
                continue;
            }
            $valueOffset = $n <= 4 ? $entry + 8 : $u32($entry + 8);
            if ($valueOffset < 0 || $valueOffset >= $len) {
                continue;
            }
            $value = Bytes::latin1(Bytes::sub($tiff, $valueOffset, $valueOffset + $n));
            $value = Bytes::trim((string) preg_replace('/\0+\z/', '', $value));
            if ($value !== '') {
                $out[$name] = $value;
            }
        }
        return $out;
    }

    /**
     * Values from an XMP packet (UTF-8). Attribute form, element form, rdf:resource and
     * rdf:Alt/Seq/Bag lists. Regex only, robust against truncated packets.
     *
     * @return array<string, string>
     */
    public static function xmp(string $xmp): array
    {
        $out = [];
        foreach (self::XMP_FIELDS as $field) {
            $f = preg_quote($field, '/');
            $value = null;
            if (preg_match('/' . $f . '\s*=\s*(["\'])([^"\']*)\1/u', $xmp, $m) === 1) {
                $value = $m[2];
            } elseif (preg_match('/<' . $f . '\s[^>]*rdf:resource\s*=\s*(["\'])([^"\']*)\1/u', $xmp, $m) === 1) {
                $value = $m[2];
            } elseif (preg_match('/<' . $f . '(\s[^>]*)?>([\s\S]*?)<\/' . $f . '>/u', $xmp, $m) === 1) {
                $inner = $m[2];
                $value = preg_match('/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/u', $inner, $li) === 1 ? $li[1] : $inner;
            }
            if ($value !== null) {
                $clean = Bytes::trim(self::decodeEntities((string) preg_replace('/<[^>]+>/u', '', $value)));
                if ($clean !== '') {
                    $out[$field] = $clean;
                }
            }
        }
        return $out;
    }

    /** @return string[] */
    public static function findXmpPackets(string $text): array
    {
        preg_match_all('/<x:xmpmeta[\s\S]*?(<\/x:xmpmeta>|\z)/u', $text, $m);
        return array_values(array_filter($m[0], static function ($p) {
            return $p !== '';
        }));
    }

    private static function decodeEntities(string $s): string
    {
        $s = str_replace(['&lt;', '&gt;', '&quot;', '&apos;'], ['<', '>', '"', "'"], $s);
        $s = (string) preg_replace_callback('/&#(\d+);/', static function (array $m): string {
            $cp = (int) $m[1];
            if (strlen($m[1]) > 7 || $cp > 0x10FFFF || ($cp >= 0xD800 && $cp <= 0xDFFF)) {
                return "\u{FFFD}";
            }
            return self::chr($cp);
        }, $s);
        return str_replace('&amp;', '&', $s);
    }

    private static function chr(int $cp): string
    {
        if ($cp < 0x80) {
            return chr($cp);
        }
        if ($cp < 0x800) {
            return chr(0xC0 | ($cp >> 6)) . chr(0x80 | ($cp & 0x3F));
        }
        if ($cp < 0x10000) {
            return chr(0xE0 | ($cp >> 12)) . chr(0x80 | (($cp >> 6) & 0x3F)) . chr(0x80 | ($cp & 0x3F));
        }
        return chr(0xF0 | ($cp >> 18)) . chr(0x80 | (($cp >> 12) & 0x3F)) . chr(0x80 | (($cp >> 6) & 0x3F)) . chr(0x80 | ($cp & 0x3F));
    }

    /** C2PA marker inside JUMBF bytes. */
    public static function isC2pa(string $jumbf): bool
    {
        return preg_match('/jumd[\s\S]{0,40}c2pa/', $jumbf) === 1;
    }

    /**
     * claim_generator / claim_generator_info.name and source type codes, without a full CBOR parser.
     *
     * @return array{generators: string[], sourceTypes: string[]}
     */
    public static function c2pa(string $jumbf): array
    {
        $generators = [];
        if (preg_match_all('/claim_generator(?!_)/', $jumbf, $m, PREG_OFFSET_CAPTURE) > 0) {
            foreach ($m[0] as [$hit, $pos]) {
                $v = self::cborText($jumbf, $pos + strlen($hit));
                if ($v !== null && $v !== '') {
                    $generators[$v] = true;
                }
            }
        }
        if (preg_match_all('/claim_generator_info/', $jumbf, $m, PREG_OFFSET_CAPTURE) > 0) {
            foreach ($m[0] as [, $pos]) {
                $window = substr($jumbf, $pos, 400);
                $name = strpos($window, "\x64name");
                if ($name !== false) {
                    $v = self::cborText($jumbf, $pos + $name + 5);
                    if ($v !== null && $v !== '') {
                        $generators[$v] = true;
                    }
                }
            }
        }
        return [
            'generators' => array_map('strval', array_keys($generators)),
            'sourceTypes' => self::findSourceTypeCodes($jumbf),
        ];
    }

    /** CBOR text string (major type 3) at $pos. */
    private static function cborText(string $b, int $pos): ?string
    {
        if (!isset($b[$pos])) {
            return null;
        }
        $head = ord($b[$pos]);
        if ($head >> 5 !== 3) {
            return null;
        }
        $info = $head & 0x1f;
        $start = $pos + 1;
        if ($info < 24) {
            $len = $info;
        } elseif ($info === 24) {
            $len = isset($b[$pos + 1]) ? ord($b[$pos + 1]) : 0;
            $start = $pos + 2;
        } elseif ($info === 25) {
            $len = ((isset($b[$pos + 1]) ? ord($b[$pos + 1]) : 0) << 8) | (isset($b[$pos + 2]) ? ord($b[$pos + 2]) : 0);
            $start = $pos + 3;
        } else {
            return null;
        }
        if ($start + $len > strlen($b)) {
            return null;
        }
        return Bytes::utf8(substr($b, $start, $len));
    }

    /** Generator parameters in PNG text chunks (Stable Diffusion UIs and others). */
    public static function matchPngText(array $entry): ?string
    {
        $k = strtolower($entry['keyword']);
        $v = $entry['value'];
        if ($k === 'parameters' && (preg_match('/\bSteps:\s*\d/', $v) === 1 || $entry['compressed'])) {
            return preg_match('/fooocus/i', $v) === 1 ? 'Fooocus' : 'Stable Diffusion (AUTOMATIC1111/Forge)';
        }
        if (($k === 'prompt' || $k === 'workflow') && (preg_match('/class_type|"nodes"/', $v) === 1 || $entry['compressed'])) {
            return 'ComfyUI';
        }
        if (in_array($k, ['invokeai_metadata', 'invokeai_graph', 'sd-metadata', 'dream'], true)) {
            return 'InvokeAI';
        }
        if ($k === 'fooocus_scheme') {
            return 'Fooocus';
        }
        if ($k === 'comment' && preg_match('/"(steps|sampler|uc)"/', $v) === 1 && preg_match('/"(prompt|seed)"/', $v) === 1) {
            return 'NovelAI';
        }
        return null;
    }
}
