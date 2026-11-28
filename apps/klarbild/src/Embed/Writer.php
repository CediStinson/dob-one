<?php
/**
 * Writes the AI note into every generated image file of an attachment (sizes, the "-scaled"
 * main file, extra formats in "sources"). The uploaded original is never changed.
 *
 * @package Klarbild
 */

namespace Klarbild\Embed;

use Klarbild\Media\Status;
use Klarbild\Settings;

if (!defined('ABSPATH')) {
    exit;
}

final class Writer
{
    /** Generated files above this size are skipped (they are read completely). */
    public const MAX_BYTES = 33554432;

    /**
     * Upload hook (wp_generate_attachment_metadata, after detection). Leaves the metadata untouched.
     *
     * @param mixed $metadata
     * @return mixed
     */
    public static function onGenerateMetadata($metadata, $id)
    {
        if (is_array($metadata)) {
            self::writeAttachment((int) $id, $metadata);
        }
        return $metadata;
    }

    /** After a person changed the status (bulk action, attachment details). */
    public static function onStatusChanged($id): void
    {
        $metadata = wp_get_attachment_metadata((int) $id);
        if (is_array($metadata)) {
            self::writeAttachment((int) $id, $metadata);
        }
    }

    /**
     * @param array<string, mixed> $metadata
     * @return array{written: int, skipped: int}
     */
    public static function writeAttachment(int $id, array $metadata): array
    {
        $done = ['written' => 0, 'skipped' => 0];
        if (!Settings::get()['write_iptc']) {
            return $done;
        }
        $sourceType = Embedder::sourceTypeFor(Status::get($id)['status']);
        if ($sourceType === null) {
            return $done;
        }
        foreach (self::generatedFiles($id, $metadata) as $path) {
            if (self::writeFile($path, $sourceType)) {
                $done['written']++;
            } else {
                $done['skipped']++;
            }
        }
        return $done;
    }

    /**
     * Absolute paths of the files WordPress generated. The original upload is excluded.
     *
     * @param array<string, mixed> $metadata
     * @return string[]
     */
    public static function generatedFiles(int $id, array $metadata): array
    {
        $main = get_attached_file($id);
        if (!is_string($main) || $main === '') {
            return [];
        }
        $dir = dirname($main);
        $names = [];
        // With big image scaling, the attached file is "-scaled" and the original is kept separately.
        if (!empty($metadata['original_image'])) {
            $names[] = basename($main);
        }
        $sizes = isset($metadata['sizes']) && is_array($metadata['sizes']) ? $metadata['sizes'] : [];
        foreach ($sizes as $size) {
            if (is_array($size)) {
                self::collect($names, $size);
            }
        }
        if (isset($metadata['sources']) && is_array($metadata['sources'])) {
            self::collect($names, ['sources' => $metadata['sources']]);
        }

        $original = basename((string) (function_exists('wp_get_original_image_path') ? wp_get_original_image_path($id) : $main));
        $paths = [];
        foreach (array_unique($names) as $name) {
            // Only plain file names in the upload folder, never paths.
            if ($name === '' || $name !== basename($name) || $name === $original || $name[0] === '.') {
                continue;
            }
            $paths[] = $dir . '/' . $name;
        }
        return $paths;
    }

    /**
     * @param string[] $names
     * @param array<string, mixed> $entry
     */
    private static function collect(array &$names, array $entry): void
    {
        if (isset($entry['file']) && is_string($entry['file'])) {
            $names[] = $entry['file'];
        }
        if (isset($entry['sources']) && is_array($entry['sources'])) {
            foreach ($entry['sources'] as $source) {
                if (is_array($source) && isset($source['file']) && is_string($source['file'])) {
                    $names[] = $source['file'];
                }
            }
        }
    }

    /** True if the file now carries the note (already had it, or was written). */
    public static function writeFile(string $path, string $sourceType): bool
    {
        if (!is_file($path) || !is_readable($path) || !is_writable($path)) {
            return false;
        }
        $size = filesize($path);
        if ($size === false || $size <= 0 || $size > self::MAX_BYTES) {
            return false;
        }
        $bytes = file_get_contents($path);
        if (!is_string($bytes) || $bytes === '') {
            return false;
        }
        if (Embedder::hasSourceType($bytes, $sourceType)) {
            return true;
        }
        $out = Embedder::embed($bytes, $sourceType);
        if ($out === null) {
            return false;
        }
        // Write next to the file, then replace it, so a broken write never leaves half a file.
        $tmp = $path . '.klarbild-' . bin2hex(random_bytes(4)) . '.tmp';
        if (file_put_contents($tmp, $out) !== strlen($out)) {
            @unlink($tmp);
            return false;
        }
        $perms = fileperms($path);
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
            return false;
        }
        if ($perms !== false) {
            @chmod($path, $perms & 0777);
        }
        return true;
    }
}
