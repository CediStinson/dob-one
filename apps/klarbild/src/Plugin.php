<?php
/**
 * Registers all hooks. T20: only the settings page, no image processing yet.
 *
 * @package Klarbild
 */

namespace Klarbild;

use Klarbild\Admin\SettingsPage;

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

        if (is_admin()) {
            (new SettingsPage())->register();
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
