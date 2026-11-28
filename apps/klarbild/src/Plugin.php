<?php
/**
 * Registers all hooks.
 *
 * @package Klarbild
 */

namespace Klarbild;

use Klarbild\Admin\MediaLibrary;
use Klarbild\Admin\SettingsPage;
use Klarbild\Embed\Writer;
use Klarbild\Media\Status;

if (!defined('ABSPATH')) {
    exit;
}

final class Plugin
{
    /** @var bool */
    private static $booted = false;

    public static function init(): void
    {
        if (self::$booted) {
            return;
        }
        self::$booted = true;

        add_action('init', [self::class, 'loadTextdomain']);
        // Detection on upload, also for uploads via REST (block editor) and WP-CLI.
        add_filter('wp_generate_attachment_metadata', [Status::class, 'onGenerateMetadata'], 20, 2);
        // Then write the AI note into every generated size (late, after core and most image plugins).
        add_filter('wp_generate_attachment_metadata', [Writer::class, 'onGenerateMetadata'], 99, 2);
        add_action('klarbild_status_changed', [Writer::class, 'onStatusChanged']);

        if (is_admin()) {
            (new SettingsPage())->register();
            (new MediaLibrary())->register();
            add_filter(
                'plugin_action_links_' . plugin_basename(KLARBILD_FILE),
                [self::class, 'actionLinks']
            );
        }
    }

    public static function loadTextdomain(): void
    {
        load_plugin_textdomain('klarbild', false, dirname(plugin_basename(KLARBILD_FILE)) . '/languages');
    }

    /**
     * Adds a "Settings" link on the plugins screen.
     *
     * @param string[] $links
     * @return string[]
     */
    public static function actionLinks(array $links): array
    {
        $url = admin_url('options-general.php?page=' . SettingsPage::SLUG);
        array_unshift(
            $links,
            '<a href="' . esc_url($url) . '">' . esc_html__('Settings', 'klarbild') . '</a>'
        );
        return $links;
    }
}
