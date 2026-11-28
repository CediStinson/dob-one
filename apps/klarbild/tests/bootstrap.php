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
];

function klarbild_wp_reset(): void
{
    $GLOBALS['klarbild_wp']['options'] = [];
    $GLOBALS['klarbild_wp']['can'] = true;
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

function current_user_can($cap)
{
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
