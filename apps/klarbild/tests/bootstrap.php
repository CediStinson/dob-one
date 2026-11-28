<?php
/**
 * Test bootstrap: minimal WordPress stubs that record calls, then loads the plugin once
 * as if in wp-admin. No WordPress install needed.
 */

define('ABSPATH', __DIR__ . '/');

$GLOBALS['klarbild_wp'] = [
    'actions' => [],
    'filters' => [],
    'options' => [],
    'settings' => [],
    'sections' => [],
    'fields' => [],
    'pages' => [],
    'is_admin' => true,
    'can' => true,
    'posts' => [],
];

function klarbild_wp_reset(): void
{
    $GLOBALS['klarbild_wp']['options'] = [];
    $GLOBALS['klarbild_wp']['can'] = true;
    $GLOBALS['klarbild_wp']['posts'] = [];
    $GLOBALS['klarbild_wp']['done'] = [];
    $GLOBALS['pagenow'] = 'upload.php';
    $_GET = [];
}

/** Test helper: an attachment with mime type and file. */
function klarbild_wp_post(int $id, string $mime, string $file = '', bool $editable = true): void
{
    $GLOBALS['klarbild_wp']['posts'][$id] = ['mime' => $mime, 'file' => $file, 'meta' => [], 'editable' => $editable];
}

function get_post_meta($id, $key = '', $single = false)
{
    return $GLOBALS['klarbild_wp']['posts'][$id]['meta'][$key] ?? '';
}

function update_post_meta($id, $key, $value)
{
    $GLOBALS['klarbild_wp']['posts'][$id]['meta'][$key] = $value;
    return true;
}

function delete_post_meta($id, $key)
{
    unset($GLOBALS['klarbild_wp']['posts'][$id]['meta'][$key]);
    return true;
}

function get_post_mime_type($id)
{
    return $GLOBALS['klarbild_wp']['posts'][$id]['mime'] ?? false;
}

function wp_get_original_image_path($id)
{
    $post = $GLOBALS['klarbild_wp']['posts'][$id] ?? [];
    return $post['original'] ?? ($post['file'] ?? false);
}

function get_attached_file($id)
{
    return $GLOBALS['klarbild_wp']['posts'][$id]['file'] ?? false;
}

function sanitize_key($key)
{
    return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $key));
}

function wp_unslash($value)
{
    return is_string($value) ? stripslashes($value) : $value;
}

function absint($value)
{
    return abs((int) $value);
}

function add_query_arg($key, $value, $url)
{
    return $url . (strpos($url, '?') === false ? '?' : '&') . rawurlencode($key) . '=' . rawurlencode((string) $value);
}

function do_action($hook, ...$args)
{
    $GLOBALS['klarbild_wp']['done'][] = [$hook, $args];
    foreach ($GLOBALS['klarbild_wp']['actions'][$hook] ?? [] as $callback) {
        call_user_func_array($callback, $args);
    }
}

function wp_get_attachment_metadata($id)
{
    return $GLOBALS['klarbild_wp']['posts'][$id]['metadata'] ?? false;
}

function _n($single, $plural, $number, $domain = 'default')
{
    return $number === 1 ? $single : $plural;
}

function add_action($hook, $callback, $priority = 10, $args = 1)
{
    $GLOBALS['klarbild_wp']['actions'][$hook][] = $callback;
    return true;
}

function add_filter($hook, $callback, $priority = 10, $args = 1)
{
    $GLOBALS['klarbild_wp']['filters'][$hook][] = $callback;
    return true;
}

function is_admin()
{
    return $GLOBALS['klarbild_wp']['is_admin'];
}

function current_user_can($cap, $id = null)
{
    if ($id !== null) {
        return $GLOBALS['klarbild_wp']['can'] && ($GLOBALS['klarbild_wp']['posts'][$id]['editable'] ?? false);
    }
    return $GLOBALS['klarbild_wp']['can'];
}

function get_option($name, $default = false)
{
    return array_key_exists($name, $GLOBALS['klarbild_wp']['options'])
        ? $GLOBALS['klarbild_wp']['options'][$name]
        : $default;
}

function plugin_basename($file)
{
    return 'klarbild/' . basename($file);
}

function load_plugin_textdomain($domain, $deprecated = false, $path = false)
{
    return true;
}

function admin_url($path = '')
{
    return 'https://example.test/wp-admin/' . ltrim($path, '/');
}

function __($text, $domain = 'default')
{
    return $text;
}

function esc_html($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

function esc_attr($text)
{
    return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
}

function esc_html__($text, $domain = 'default')
{
    return esc_html($text);
}

function esc_url($url)
{
    return htmlspecialchars((string) $url, ENT_QUOTES, 'UTF-8');
}

function selected($a, $b, $echo = true)
{
    return (string) $a === (string) $b ? ' selected="selected"' : '';
}

function checked($a, $b, $echo = true)
{
    return $a === $b ? ' checked="checked"' : '';
}

function add_options_page($title, $menu, $cap, $slug, $callback)
{
    $GLOBALS['klarbild_wp']['pages'][$slug] = ['cap' => $cap, 'callback' => $callback];
    return 'settings_page_' . $slug;
}

function register_setting($group, $name, $args = [])
{
    $GLOBALS['klarbild_wp']['settings'][$name] = ['group' => $group] + $args;
}

function add_settings_section($id, $title, $callback, $page)
{
    $GLOBALS['klarbild_wp']['sections'][$id] = $callback;
}

function add_settings_field($id, $title, $callback, $page, $section)
{
    $GLOBALS['klarbild_wp']['fields'][$id] = $callback;
}

function settings_fields($group)
{
    echo '<input type="hidden" name="option_page" value="' . esc_attr($group) . '">';
}

function do_settings_sections($page)
{
    foreach ($GLOBALS['klarbild_wp']['fields'] as $callback) {
        call_user_func($callback);
    }
}

function submit_button()
{
    echo '<button type="submit">Save</button>';
}

require dirname(__DIR__) . '/klarbild.php';
