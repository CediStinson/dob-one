<?php
/**
 * Plugin Name:       Klarbild
 * Description:       Marks AI-generated images in the media library, labels them visibly and keeps the provenance metadata (Art. 50 EU AI Act).
 * Version:           0.1.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            dobsonstudio
 * Author URI:        https://dobsonstudio.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       klarbild
 * Domain Path:       /languages
 *
 * @package Klarbild
 */

if (!defined('ABSPATH')) {
    exit;
}

define('KLARBILD_VERSION', '0.1.0');
define('KLARBILD_FILE', __FILE__);
define('KLARBILD_DIR', __DIR__);

spl_autoload_register(static function ($class) {
    $prefix = 'Klarbild\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = KLARBILD_DIR . '/src/' . $relative . '.php';
    if (is_readable($file)) {
        require $file;
    }
});

\Klarbild\Plugin::init();
