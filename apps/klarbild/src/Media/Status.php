<?php
/**
 * AI status of an attachment, stored as post meta.
 *
 * _klarbild_status    ai | ai_partial | unclear | none (missing = not checked)
 * _klarbild_source    detected | manual
 * _klarbild_detected  verdict of the last detection (kept when a person overrides it)
 * _klarbild_generator detected generator name, if any
 *
 * @package Klarbild
 */

namespace Klarbild\Media;

use Klarbild\Detect\Detector;

if (!defined('ABSPATH')) {
    exit;
}

final class Status
{
    public const META_STATUS = '_klarbild_status';
    public const META_SOURCE = '_klarbild_source';
    public const META_DETECTED = '_klarbild_detected';
    public const META_GENERATOR = '_klarbild_generator';

    public const STATUSES = ['ai', 'ai_partial', 'unclear', 'none'];

    /** What a person can set by hand. "unclear" only comes from detection. */
    public const MANUAL = ['ai', 'ai_partial', 'none'];

    /** Formats the detector understands (others are stored as "none" only if readable). */
    private const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif'];

    /**
     * @return array{status: string|null, source: string|null, generator: string}
     */
    public static function get(int $id): array
    {
        $status = (string) get_post_meta($id, self::META_STATUS, true);
        $source = (string) get_post_meta($id, self::META_SOURCE, true);
        return [
            'status' => in_array($status, self::STATUSES, true) ? $status : null,
            'source' => in_array($source, ['detected', 'manual'], true) ? $source : null,
            'generator' => (string) get_post_meta($id, self::META_GENERATOR, true),
        ];
    }

    public static function isSupported(int $id): bool
    {
        return in_array((string) get_post_mime_type($id), self::MIME_TYPES, true);
    }

    /**
     * Runs detection on the original file. A status set by a person is never overwritten.
     *
     * @return string|null new verdict, or null if not checked
     */
    public static function detect(int $id): ?string
    {
        if (!self::isSupported($id)) {
            return null;
        }
        $path = function_exists('wp_get_original_image_path') ? wp_get_original_image_path($id) : false;
        if (!is_string($path) || $path === '') {
            $path = get_attached_file($id);
        }
        if (!is_string($path) || $path === '') {
            return null;
        }
        $result = Detector::detectFile($path);
        if ($result === null) {
            return null;
        }
        $verdict = $result['verdict'];
        update_post_meta($id, self::META_DETECTED, $verdict);
        if (isset($result['generator'])) {
            update_post_meta($id, self::META_GENERATOR, $result['generator']);
        } else {
            delete_post_meta($id, self::META_GENERATOR);
        }
        if (self::get($id)['source'] !== 'manual') {
            update_post_meta($id, self::META_STATUS, $verdict);
            update_post_meta($id, self::META_SOURCE, 'detected');
        }
        return $verdict;
    }

    /** Status chosen by a person. Returns false for invalid values. */
    public static function setManual(int $id, string $status): bool
    {
        if (!in_array($status, self::MANUAL, true)) {
            return false;
        }
        update_post_meta($id, self::META_STATUS, $status);
        update_post_meta($id, self::META_SOURCE, 'manual');
        return true;
    }

    /** Back to the detected verdict (or "not checked" if never detected). */
    public static function resetToDetected(int $id): void
    {
        $detected = (string) get_post_meta($id, self::META_DETECTED, true);
        if (in_array($detected, self::STATUSES, true)) {
            update_post_meta($id, self::META_STATUS, $detected);
            update_post_meta($id, self::META_SOURCE, 'detected');
            return;
        }
        delete_post_meta($id, self::META_STATUS);
        delete_post_meta($id, self::META_SOURCE);
    }

    /**
     * "none" from detection only means "no hint in the metadata", never "not AI".
     */
    public static function label(?string $status, ?string $source = null): string
    {
        switch ($status) {
            case 'ai':
                return __('AI-generated', 'klarbild');
            case 'ai_partial':
                return __('Partly AI', 'klarbild');
            case 'unclear':
                return __('Unclear', 'klarbild');
            case 'none':
                return $source === 'manual' ? __('No AI image', 'klarbild') : __('No AI hint', 'klarbild');
            default:
                return __('Not checked', 'klarbild');
        }
    }

    /**
     * Upload hook (wp_generate_attachment_metadata). Leaves the metadata untouched.
     *
     * @param mixed $metadata
     * @return mixed
     */
    public static function onGenerateMetadata($metadata, $id)
    {
        self::detect((int) $id);
        return $metadata;
    }
}
