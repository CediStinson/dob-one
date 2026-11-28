<?php
/**
 * Removes the plugin options on uninstall. Attachment meta and the log (later versions)
 * are handled here as well once they exist.
 *
 * @package Klarbild
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('klarbild_settings');
