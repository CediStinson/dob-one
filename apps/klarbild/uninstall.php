<?php
/**
 * Removes the plugin options on uninstall. The AI status per image (post meta) is kept on purpose:
 * it documents which images were marked, and deleting the plugin must not erase that.
 *
 * @package Klarbild
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('klarbild_settings');
