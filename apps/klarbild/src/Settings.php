<?php
/**
 * Plugin options: defaults, sanitizing, reading. Pure logic, no output.
 *
 * @package Klarbild
 */

namespace Klarbild;

if (!defined('ABSPATH')) {
    exit;
}

final class Settings
{
    public const OPTION = 'klarbild_settings';

    public const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

    public const MAX_ALT_SUFFIX = 60;

    /**
     * @return array{overlay: bool, overlay_position: string, alt_suffix: bool, alt_suffix_text: string, write_iptc: bool}
     */
    public static function defaults(): array
    {
        return [
            // Visible "KI" label as HTML overlay (T23).
            'overlay' => true,
            'overlay_position' => 'bottom-right',
            // Append a note to the alt text (T23), off by default.
            'alt_suffix' => false,
            'alt_suffix_text' => 'KI-generiert',
            // Write IPTC DigitalSourceType into every image size (T22).
            'write_iptc' => true,
        ];
    }

    /**
     * Cleans raw form input. Unknown keys are dropped, invalid values fall back to the default.
     * Checkboxes that are missing in the form count as "off".
     *
     * @param mixed $input
     * @return array{overlay: bool, overlay_position: string, alt_suffix: bool, alt_suffix_text: string, write_iptc: bool}
     */
    public static function sanitize($input): array
    {
        $defaults = self::defaults();
        if (!is_array($input)) {
            return $defaults;
        }

        $position = isset($input['overlay_position']) && is_string($input['overlay_position'])
            ? $input['overlay_position']
            : '';
        if (!in_array($position, self::POSITIONS, true)) {
            $position = $defaults['overlay_position'];
        }

        $text = isset($input['alt_suffix_text']) && is_string($input['alt_suffix_text'])
            ? self::cleanText($input['alt_suffix_text'])
            : '';
        if ($text === '') {
            $text = $defaults['alt_suffix_text'];
        }

        return [
            'overlay' => self::flag($input, 'overlay'),
            'overlay_position' => $position,
            'alt_suffix' => self::flag($input, 'alt_suffix'),
            'alt_suffix_text' => $text,
            'write_iptc' => self::flag($input, 'write_iptc'),
        ];
    }

    /**
     * Stored options merged over the defaults.
     *
     * @return array{overlay: bool, overlay_position: string, alt_suffix: bool, alt_suffix_text: string, write_iptc: bool}
     */
    public static function get(): array
    {
        $stored = get_option(self::OPTION, null);
        if (!is_array($stored)) {
            return self::defaults();
        }
        // Stored values were sanitized on save; sanitize again so old or broken rows stay safe.
        return self::sanitize(array_merge(self::defaults(), $stored));
    }

    /**
     * @param array<mixed> $input
     */
    private static function flag(array $input, string $key): bool
    {
        if (!isset($input[$key])) {
            return false;
        }
        $value = $input[$key];
        return $value === true || $value === 1 || $value === '1' || $value === 'on';
    }

    private static function cleanText(string $text): string
    {
        // No tags, no control characters, collapsed whitespace, limited length.
        $text = strip_tags($text);
        $text = (string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $text);
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));
        if (function_exists('mb_substr')) {
            return mb_substr($text, 0, self::MAX_ALT_SUFFIX, 'UTF-8');
        }
        return substr($text, 0, self::MAX_ALT_SUFFIX);
    }
}
