<?php

use Klarbild\Admin\SettingsPage;
use Klarbild\Plugin;
use Klarbild\Settings;
use PHPUnit\Framework\TestCase;

final class PluginTest extends TestCase
{
    protected function setUp(): void
    {
        klarbild_wp_reset();
    }

    /**
     * @return array<string, string>
     */
    private static function header(): array
    {
        $source = (string) file_get_contents(dirname(__DIR__) . '/klarbild.php');
        preg_match_all('/^\s*\*\s*([A-Za-z ]+):\s*(.+)$/m', $source, $m, PREG_SET_ORDER);
        $out = [];
        foreach ($m as $row) {
            $out[trim($row[1])] = trim($row[2]);
        }
        return $out;
    }

    public function testPluginHeaderIsComplete(): void
    {
        $h = self::header();
        $this->assertSame('Klarbild', $h['Plugin Name']);
        $this->assertSame('klarbild', $h['Text Domain']);
        $this->assertSame('GPL-2.0-or-later', $h['License']);
        $this->assertSame('7.4', $h['Requires PHP']);
        $this->assertSame('6.2', $h['Requires at least']);
        $this->assertSame('dobsonstudio', $h['Author']);
    }

    public function testVersionIsConsistent(): void
    {
        $h = self::header();
        $this->assertSame(KLARBILD_VERSION, $h['Version']);
        $readme = (string) file_get_contents(dirname(__DIR__) . '/readme.txt');
        $this->assertMatchesRegularExpression('/^Stable tag: ' . preg_quote(KLARBILD_VERSION, '/') . '$/m', $readme);
        $this->assertMatchesRegularExpression('/^Requires PHP: 7\.4$/m', $readme);
    }

    public function testAdminHooksAreRegistered(): void
    {
        $wp = $GLOBALS['klarbild_wp'];
        $this->assertArrayHasKey('init', $wp['actions']);
        $this->assertArrayHasKey('admin_menu', $wp['actions']);
        $this->assertArrayHasKey('admin_init', $wp['actions']);
        $this->assertArrayHasKey('plugin_action_links_klarbild/klarbild.php', $wp['filters']);
    }

    public function testInitIsIdempotent(): void
    {
        $before = count($GLOBALS['klarbild_wp']['actions']['admin_menu']);
        Plugin::init();
        $this->assertCount($before, $GLOBALS['klarbild_wp']['actions']['admin_menu']);
    }

    public function testActionLinkComesFirst(): void
    {
        $links = Plugin::actionLinks(['<a href="#">Deactivate</a>']);
        $this->assertCount(2, $links);
        $this->assertStringContainsString('options-general.php?page=klarbild', $links[0]);
    }

    public function testSettingIsRegisteredWithSanitizer(): void
    {
        $page = new SettingsPage();
        $page->addPage();
        $page->registerSettings();
        $wp = $GLOBALS['klarbild_wp'];
        $this->assertSame('manage_options', $wp['pages']['klarbild']['cap']);
        $setting = $wp['settings'][Settings::OPTION];
        $this->assertSame([Settings::class, 'sanitize'], $setting['sanitize_callback']);
        $this->assertFalse($setting['show_in_rest']);
    }

    public function testRenderEscapesStoredValues(): void
    {
        $page = new SettingsPage();
        $page->registerSettings();
        // Simulates a row written around the sanitizer; output must still be escaped.
        // strip_tags removes tags, but an attribute break-out survives it and must be escaped.
        $GLOBALS['klarbild_wp']['options'][Settings::OPTION] = ['alt_suffix_text' => '" autofocus onfocus="alert(1)'];
        ob_start();
        $page->render();
        $html = (string) ob_get_clean();
        $this->assertStringContainsString('<form', $html);
        $this->assertStringContainsString('name="klarbild_settings[overlay]"', $html);
        $this->assertStringContainsString('value="&quot; autofocus onfocus=&quot;alert(1)"', $html);
        $this->assertStringNotContainsString('onfocus="alert', $html);
    }

    public function testRenderNeedsCapability(): void
    {
        $GLOBALS['klarbild_wp']['can'] = false;
        ob_start();
        (new SettingsPage())->render();
        $this->assertSame('', ob_get_clean());
    }

    public function testEveryPhpFileIsGuarded(): void
    {
        $root = dirname(__DIR__);
        $files = array_merge([$root . '/klarbild.php', $root . '/uninstall.php'], self::phpFiles($root . '/src'));
        foreach ($files as $file) {
            $source = (string) file_get_contents($file);
            $guard = basename($file) === 'uninstall.php' ? "defined('WP_UNINSTALL_PLUGIN')" : "defined('ABSPATH')";
            $this->assertStringContainsString($guard, $source, $file);
        }
    }

    /**
     * @return string[]
     */
    private static function phpFiles(string $dir): array
    {
        $out = [];
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if ($file->getExtension() === 'php') {
                $out[] = $file->getPathname();
            }
        }
        return $out;
    }
}
