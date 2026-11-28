<?php
/**
 * Checks image bytes for AI hints in the metadata. Port of packages/detect/src/detect.ts;
 * both must give the same result (shared list packages/detect/fixtures/expected.json).
 *
 * Verdicts: ai (clear AI hint), ai_partial (composite or AI edit), unclear (C2PA provenance
 * without AI statement), none (no hints; not proof that the image is not AI).
 *
 * @package Klarbild
 */

namespace Klarbild\Detect;

if (!defined('ABSPATH')) {
    exit;
}

final class Detector
{
    /** The plugin, like the scanner, reads only the start of a file. */
    public const READ_BYTES = 262144;

    private const GENERATOR_FIELDS_EXIF = ['Software', 'Make', 'Artist'];
    private const GENERATOR_FIELDS_XMP = ['xmp:CreatorTool', 'tiff:Software', 'photoshop:Credit'];

    /**
     * Reads the first 256 KB of a file. Returns null if the file cannot be read.
     */
    public static function detectFile(string $path): ?array
    {
        if (!is_file($path) || !is_readable($path)) {
            return null;
        }
        $handle = @fopen($path, 'rb');
        if ($handle === false) {
            return null;
        }
        $bytes = fread($handle, self::READ_BYTES);
        fclose($handle);
        return self::detect($bytes === false ? '' : $bytes);
    }

    /**
     * Never throws; unknown or broken data gives verdict "none".
     *
     * @return array{format: string, verdict: string, findings: list<array<string, string>>, generator?: string, has: array{c2pa: bool, xmp: bool, exif: bool}}
     */
    public static function detect(string $bytes): array
    {
        $format = Containers::sniff($bytes);
        $raw = self::extract($format, $bytes);
        $findings = [];
        $c2pa = array_values(array_filter($raw['jumbf'], [Fields::class, 'isC2pa']));

        foreach ($c2pa as $jumbf) {
            $info = Fields::c2pa($jumbf);
            foreach ($info['sourceTypes'] as $code) {
                $meaning = Fields::classifySourceType($code)['meaning'];
                if ($meaning !== 'not_ai') {
                    $findings[] = self::finding('c2pa', 'c2pa.actions.digitalSourceType', $code, $meaning);
                }
            }
            foreach ($info['generators'] as $g) {
                $generator = Fields::matchGenerator($g);
                $findings[] = self::finding('c2pa', 'claim_generator', $g, $generator !== null ? 'ai_generated' : 'provenance', $generator);
            }
            if (count($info['generators']) === 0 && count($info['sourceTypes']) === 0) {
                $findings[] = self::finding('c2pa', 'manifest', 'C2PA', 'provenance');
            }
        }

        foreach ($raw['xmp'] as $packet) {
            $x = Fields::xmp($packet);
            if (isset($x['Iptc4xmpExt:DigitalSourceType'])) {
                $st = Fields::classifySourceType($x['Iptc4xmpExt:DigitalSourceType']);
                if ($st['meaning'] !== 'not_ai') {
                    $findings[] = self::finding('xmp', 'Iptc4xmpExt:DigitalSourceType', $st['code'], $st['meaning']);
                }
            }
            foreach (self::GENERATOR_FIELDS_XMP as $field) {
                self::pushGenerator($findings, 'xmp', $field, $x[$field] ?? '');
            }
        }

        foreach ($raw['exif'] as $tiff) {
            $e = Fields::exif($tiff);
            foreach (self::GENERATOR_FIELDS_EXIF as $field) {
                self::pushGenerator($findings, 'exif', $field, $e[$field] ?? '');
            }
        }

        foreach ($raw['text'] as $t) {
            $generator = Fields::matchPngText($t);
            if ($generator === null && $t['keyword'] === 'Software') {
                $generator = Fields::matchGenerator($t['value']);
            }
            if ($generator !== null) {
                $findings[] = self::finding('png-text', $t['keyword'], Bytes::head($t['value'], 200), 'ai_generated', $generator);
            }
        }

        $result = [
            'format' => $format,
            'verdict' => self::verdict($findings),
            'findings' => self::dedupe($findings),
        ];
        foreach ($findings as $f) {
            if (isset($f['generator'])) {
                $result['generator'] = $f['generator'];
                break;
            }
        }
        $result['has'] = [
            'c2pa' => count($c2pa) > 0,
            'xmp' => count($raw['xmp']) > 0,
            'exif' => count($raw['exif']) > 0,
        ];
        return $result;
    }

    private static function extract(string $format, string $bytes): array
    {
        if ($format === 'jpeg') {
            $raw = Containers::jpeg($bytes);
        } elseif ($format === 'png') {
            $raw = Containers::png($bytes);
        } elseif ($format === 'webp') {
            $raw = Containers::webp($bytes);
        } else {
            $raw = Containers::emptyRaw();
        }
        if (count($raw['xmp']) === 0) {
            $raw['xmp'] = Fields::findXmpPackets(Bytes::latin1($bytes));
        }
        if (count($raw['jumbf']) === 0 && $format !== 'png' && $format !== 'jpeg' && Fields::isC2pa($bytes)) {
            $raw['jumbf'][] = $bytes; // e.g. AVIF/HEIF: C2PA box somewhere in the file
        }
        return $raw;
    }

    /** @return array<string, string> */
    private static function finding(string $source, string $field, string $value, string $meaning, ?string $generator = null): array
    {
        $f = ['source' => $source, 'field' => $field, 'value' => $value, 'meaning' => $meaning];
        if ($generator !== null) {
            $f['generator'] = $generator;
        }
        return $f;
    }

    private static function pushGenerator(array &$findings, string $source, string $field, string $value): void
    {
        if ($value === '') {
            return;
        }
        $generator = Fields::matchGenerator($value);
        if ($generator !== null) {
            $findings[] = self::finding($source, $field, $value, 'ai_generated', $generator);
        }
    }

    private static function verdict(array $findings): string
    {
        $m = array_column($findings, 'meaning');
        if (in_array('ai_generated', $m, true)) {
            return 'ai';
        }
        if (in_array('ai_composite', $m, true) || in_array('ai_edited', $m, true)) {
            return 'ai_partial';
        }
        if (in_array('provenance', $m, true)) {
            return 'unclear';
        }
        return 'none';
    }

    private static function dedupe(array $findings): array
    {
        $seen = [];
        $out = [];
        foreach ($findings as $f) {
            $key = $f['source'] . '|' . $f['field'] . '|' . $f['value'];
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = $f;
        }
        return $out;
    }
}
