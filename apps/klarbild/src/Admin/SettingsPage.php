<?php
/**
 * Settings > Klarbild. Uses the WordPress Settings API, all output escaped.
 *
 * @package Klarbild
 */

namespace Klarbild\Admin;

use Klarbild\Settings;

if (!defined('ABSPATH')) {
    exit;
}

final class SettingsPage
{
    public const SLUG = 'klarbild';

    private const GROUP = 'klarbild';

    public function register(): void
    {
        add_action('admin_menu', [$this, 'addPage']);
        add_action('admin_init', [$this, 'registerSettings']);
    }

    public function addPage(): void
    {
        add_options_page(
            __('Klarbild', 'klarbild'),
            __('Klarbild', 'klarbild'),
            'manage_options',
            self::SLUG,
            [$this, 'render']
        );
    }

    public function registerSettings(): void
    {
        register_setting(self::GROUP, Settings::OPTION, [
            'type' => 'array',
            'sanitize_callback' => [Settings::class, 'sanitize'],
            'default' => Settings::defaults(),
            'show_in_rest' => false,
        ]);

        add_settings_section(
            'klarbild_label',
            __('Visible label', 'klarbild'),
            [$this, 'renderLabelIntro'],
            self::SLUG
        );
        add_settings_field('overlay', __('Label on image', 'klarbild'), [$this, 'fieldOverlay'], self::SLUG, 'klarbild_label');
        add_settings_field('overlay_position', __('Position', 'klarbild'), [$this, 'fieldPosition'], self::SLUG, 'klarbild_label');
        add_settings_field('alt_suffix', __('Alt text', 'klarbild'), [$this, 'fieldAltSuffix'], self::SLUG, 'klarbild_label');

        add_settings_section(
            'klarbild_meta',
            __('Metadata', 'klarbild'),
            '__return_false',
            self::SLUG
        );
        add_settings_field('write_iptc', __('Provenance data', 'klarbild'), [$this, 'fieldWriteIptc'], self::SLUG, 'klarbild_meta');
    }

    public function render(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__('Klarbild', 'klarbild') . '</h1>';
        echo '<div class="notice notice-info inline"><p>'
            . esc_html__('Early version: AI detection on upload and the metadata note are active. The visible label follows in the next version.', 'klarbild')
            . '</p></div>';
        echo '<form action="' . esc_url(admin_url('options.php')) . '" method="post">';
        settings_fields(self::GROUP);
        do_settings_sections(self::SLUG);
        submit_button();
        echo '</form>';
        echo '<p class="description">'
            . esc_html__('Klarbild helps you label AI images. It does not provide legal advice.', 'klarbild')
            . '</p>';
        echo '</div>';
    }

    public function renderLabelIntro(): void
    {
        echo '<p>' . esc_html__('Images marked as AI get a small label in a corner. The original file stays unchanged.', 'klarbild') . '</p>';
    }

    public function fieldOverlay(): void
    {
        $this->checkbox('overlay', __('Show "KI" label on AI images', 'klarbild'));
    }

    public function fieldPosition(): void
    {
        $settings = Settings::get();
        $labels = [
            'top-left' => __('Top left', 'klarbild'),
            'top-right' => __('Top right', 'klarbild'),
            'bottom-left' => __('Bottom left', 'klarbild'),
            'bottom-right' => __('Bottom right', 'klarbild'),
        ];
        echo '<select id="klarbild-overlay-position" name="' . esc_attr(Settings::OPTION . '[overlay_position]') . '">';
        foreach (Settings::POSITIONS as $position) {
            echo '<option value="' . esc_attr($position) . '"' . selected($settings['overlay_position'], $position, false) . '>'
                . esc_html($labels[$position])
                . '</option>';
        }
        echo '</select>';
    }

    public function fieldAltSuffix(): void
    {
        $settings = Settings::get();
        $this->checkbox('alt_suffix', __('Append a note to the alt text', 'klarbild'));
        echo '<br><label for="klarbild-alt-suffix-text">' . esc_html__('Note', 'klarbild') . '</label> ';
        echo '<input type="text" class="regular-text" id="klarbild-alt-suffix-text"'
            . ' name="' . esc_attr(Settings::OPTION . '[alt_suffix_text]') . '"'
            . ' value="' . esc_attr($settings['alt_suffix_text']) . '"'
            . ' maxlength="' . esc_attr((string) Settings::MAX_ALT_SUFFIX) . '">';
    }

    public function fieldWriteIptc(): void
    {
        $this->checkbox('write_iptc', __('Write the AI note (IPTC) into every image size', 'klarbild'));
        echo '<p class="description">'
            . esc_html__('WordPress and many optimizers remove metadata when creating image sizes. Klarbild writes it again.', 'klarbild')
            . '</p>';
    }

    private function checkbox(string $key, string $label): void
    {
        $settings = Settings::get();
        $id = 'klarbild-' . str_replace('_', '-', $key);
        echo '<label for="' . esc_attr($id) . '">';
        echo '<input type="checkbox" id="' . esc_attr($id) . '" name="' . esc_attr(Settings::OPTION . '[' . $key . ']') . '" value="1"'
            . checked(!empty($settings[$key]), true, false) . '> ';
        echo esc_html($label) . '</label>';
    }
}
