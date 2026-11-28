<?php
/**
 * Media library integration: "AI" column and filter (list view), bulk actions,
 * status field in the attachment details (list and grid view).
 *
 * @package Klarbild
 */

namespace Klarbild\Admin;

use Klarbild\Media\Status;

if (!defined('ABSPATH')) {
    exit;
}

final class MediaLibrary
{
    public const COLUMN = 'klarbild';
    public const FILTER_PARAM = 'klarbild_status';
    public const FILTER_VALUES = ['ai', 'ai_partial', 'unclear', 'none', 'unchecked'];
    public const NOTICE_PARAM = 'klarbild_marked';

    private const BULK = [
        'klarbild_mark_ai' => 'ai',
        'klarbild_mark_ai_partial' => 'ai_partial',
        'klarbild_mark_none' => 'none',
        'klarbild_mark_auto' => '',
    ];

    public function register(): void
    {
        add_filter('manage_media_columns', [$this, 'addColumn']);
        add_action('manage_media_custom_column', [$this, 'renderColumn'], 10, 2);
        add_action('restrict_manage_posts', [$this, 'renderFilter']);
        add_action('pre_get_posts', [$this, 'applyFilter']);
        add_filter('bulk_actions-upload', [$this, 'addBulkActions']);
        add_filter('handle_bulk_actions-upload', [$this, 'handleBulkAction'], 10, 3);
        add_action('admin_notices', [$this, 'renderNotice']);
        add_filter('attachment_fields_to_edit', [$this, 'addField'], 10, 2);
        add_filter('attachment_fields_to_save', [$this, 'saveField'], 10, 2);
    }

    /**
     * @param array<string, string> $columns
     * @return array<string, string>
     */
    public function addColumn(array $columns): array
    {
        $columns[self::COLUMN] = __('AI', 'klarbild');
        return $columns;
    }

    public function renderColumn($column, $id): void
    {
        if ($column !== self::COLUMN) {
            return;
        }
        $id = (int) $id;
        if (!Status::isSupported($id)) {
            echo '<span aria-hidden="true">&ndash;</span>';
            return;
        }
        $s = Status::get($id);
        echo '<span class="klarbild-status klarbild-status-' . esc_attr($s['status'] ?? 'unchecked') . '">'
            . esc_html(Status::label($s['status'], $s['source']))
            . '</span>';
        if ($s['source'] === 'manual') {
            echo '<br><small>' . esc_html__('set by hand', 'klarbild') . '</small>';
        } elseif ($s['generator'] !== '') {
            echo '<br><small>' . esc_html($s['generator']) . '</small>';
        }
    }

    public function renderFilter($postType = ''): void
    {
        if (!$this->isMediaList()) {
            return;
        }
        $current = self::currentFilter();
        $options = [
            '' => __('AI status: all', 'klarbild'),
            'ai' => Status::label('ai'),
            'ai_partial' => Status::label('ai_partial'),
            'unclear' => Status::label('unclear'),
            'none' => Status::label('none'),
            'unchecked' => Status::label(null),
        ];
        echo '<label for="klarbild-filter" class="screen-reader-text">' . esc_html__('Filter by AI status', 'klarbild') . '</label>';
        echo '<select name="' . esc_attr(self::FILTER_PARAM) . '" id="klarbild-filter">';
        foreach ($options as $value => $label) {
            echo '<option value="' . esc_attr($value) . '"' . selected($current, $value, false) . '>' . esc_html($label) . '</option>';
        }
        echo '</select>';
    }

    /** Adds the meta query to the media list main query. */
    public function applyFilter($query): void
    {
        if (!is_object($query) || !method_exists($query, 'is_main_query') || !$query->is_main_query() || !$this->isMediaList()) {
            return;
        }
        $filter = self::currentFilter();
        if ($filter === '') {
            return;
        }
        $query->set('meta_query', self::metaQuery($filter));
    }

    /**
     * @return array<int|string, mixed>
     */
    public static function metaQuery(string $filter): array
    {
        if ($filter === 'unchecked') {
            return [['key' => Status::META_STATUS, 'compare' => 'NOT EXISTS']];
        }
        return [['key' => Status::META_STATUS, 'value' => $filter, 'compare' => '=']];
    }

    public static function currentFilter(): string
    {
        $value = isset($_GET[self::FILTER_PARAM]) && is_string($_GET[self::FILTER_PARAM])
            ? sanitize_key(wp_unslash($_GET[self::FILTER_PARAM]))
            : '';
        return in_array($value, self::FILTER_VALUES, true) ? $value : '';
    }

    /**
     * @param array<string, string> $actions
     * @return array<string, string>
     */
    public function addBulkActions(array $actions): array
    {
        $actions['klarbild_mark_ai'] = __('Mark as AI-generated', 'klarbild');
        $actions['klarbild_mark_ai_partial'] = __('Mark as partly AI', 'klarbild');
        $actions['klarbild_mark_none'] = __('Mark as no AI image', 'klarbild');
        $actions['klarbild_mark_auto'] = __('AI status: back to automatic', 'klarbild');
        return $actions;
    }

    /**
     * Core has already checked the "bulk-media" nonce. Each item is checked for edit rights.
     *
     * @param string $redirect
     * @param string $action
     * @param array<int|string> $ids
     */
    public function handleBulkAction($redirect, $action, $ids): string
    {
        $redirect = (string) $redirect;
        if (!is_string($action) || !array_key_exists($action, self::BULK)) {
            return $redirect;
        }
        $status = self::BULK[$action];
        $count = 0;
        foreach ((array) $ids as $id) {
            $id = (int) $id;
            if ($id <= 0 || !current_user_can('edit_post', $id) || !Status::isSupported($id)) {
                continue;
            }
            if ($status === '') {
                Status::resetToDetected($id);
            } else {
                Status::setManual($id, $status);
            }
            do_action('klarbild_status_changed', $id);
            $count++;
        }
        return add_query_arg(self::NOTICE_PARAM, $count, $redirect);
    }

    public function renderNotice(): void
    {
        if (!$this->isMediaList() || !isset($_GET[self::NOTICE_PARAM])) {
            return;
        }
        $count = absint(wp_unslash($_GET[self::NOTICE_PARAM]));
        /* translators: %d: number of images */
        $text = sprintf(_n('AI status changed for %d image.', 'AI status changed for %d images.', $count, 'klarbild'), $count);
        echo '<div class="notice notice-success is-dismissible"><p>' . esc_html($text) . '</p></div>';
    }

    /**
     * Status select in the attachment details (also in the grid view modal).
     *
     * @param array<string, mixed> $fields
     * @param object $post
     * @return array<string, mixed>
     */
    public function addField($fields, $post): array
    {
        $fields = is_array($fields) ? $fields : [];
        $id = isset($post->ID) ? (int) $post->ID : 0;
        if ($id <= 0 || !Status::isSupported($id)) {
            return $fields;
        }
        $s = Status::get($id);
        $current = $s['source'] === 'manual' ? (string) $s['status'] : '';
        $name = 'attachments[' . $id . '][klarbild]';
        $detected = (string) get_post_meta($id, Status::META_DETECTED, true);
        $options = [
            '' => sprintf(
                /* translators: %s: detected status */
                __('Automatic (%s)', 'klarbild'),
                Status::label(in_array($detected, Status::STATUSES, true) ? $detected : null)
            ),
            'ai' => __('AI-generated', 'klarbild'),
            'ai_partial' => __('Edited with AI / partly AI', 'klarbild'),
            'none' => __('No AI image', 'klarbild'),
        ];
        $html = '<select name="' . esc_attr($name) . '" id="' . esc_attr('klarbild-field-' . $id) . '">';
        foreach ($options as $value => $label) {
            $html .= '<option value="' . esc_attr($value) . '"' . selected($current, $value, false) . '>' . esc_html($label) . '</option>';
        }
        $html .= '</select>';
        $fields['klarbild'] = [
            'label' => __('AI image', 'klarbild'),
            'input' => 'html',
            'html' => $html,
            'helps' => $s['generator'] !== '' ? sprintf(
                /* translators: %s: generator name */
                __('Detected: %s', 'klarbild'),
                $s['generator']
            ) : '',
        ];
        return $fields;
    }

    /**
     * Core checks nonce and edit rights before this filter runs; checked again here.
     *
     * @param array<string, mixed> $post
     * @param array<string, mixed> $attachment
     * @return array<string, mixed>
     */
    public function saveField($post, $attachment): array
    {
        $post = is_array($post) ? $post : [];
        $id = isset($post['ID']) ? (int) $post['ID'] : 0;
        if ($id <= 0 || !is_array($attachment) || !array_key_exists('klarbild', $attachment) || !current_user_can('edit_post', $id)) {
            return $post;
        }
        $value = is_string($attachment['klarbild']) ? sanitize_key($attachment['klarbild']) : '';
        if ($value === '') {
            Status::resetToDetected($id);
        } elseif (in_array($value, Status::MANUAL, true)) {
            Status::setManual($id, $value);
        } else {
            return $post;
        }
        do_action('klarbild_status_changed', $id);
        return $post;
    }

    private function isMediaList(): bool
    {
        global $pagenow;
        return is_admin() && $pagenow === 'upload.php';
    }
}
