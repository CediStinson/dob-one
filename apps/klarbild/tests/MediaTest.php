<?php

use Klarbild\Admin\MediaLibrary;
use Klarbild\Media\Status;
use PHPUnit\Framework\TestCase;

final class MediaTest extends TestCase
{
    private const FIXTURES = __DIR__ . '/../../../packages/detect/fixtures/';

    protected function setUp(): void
    {
        klarbild_wp_reset();
    }

    private static function meta(int $id): array
    {
        return $GLOBALS['klarbild_wp']['posts'][$id]['meta'];
    }

    public function testUploadHookIsRegisteredEverywhere(): void
    {
        // Detection (priority 20) first, then writing into the sizes (priority 99).
        $this->assertSame(
            [[Status::class, 'onGenerateMetadata'], [\Klarbild\Embed\Writer::class, 'onGenerateMetadata']],
            $GLOBALS['klarbild_wp']['filters']['wp_generate_attachment_metadata']
        );
    }

    public function testUploadStoresDetectedStatus(): void
    {
        klarbild_wp_post(5, 'image/jpeg', self::FIXTURES . 'jpeg-c2pa-chatgpt.jpg');
        $metadata = ['width' => 32];
        $this->assertSame($metadata, Status::onGenerateMetadata($metadata, 5));
        $m = self::meta(5);
        $this->assertSame('ai', $m[Status::META_STATUS]);
        $this->assertSame('detected', $m[Status::META_SOURCE]);
        $this->assertSame('ai', $m[Status::META_DETECTED]);
        $this->assertSame('ChatGPT / OpenAI', $m[Status::META_GENERATOR]);
    }

    public function testAllVerdictsFromFixtures(): void
    {
        $cases = [
            ['png-xmp-composite.png', 'image/png', 'ai_partial'],
            ['jpeg-c2pa-camera.jpg', 'image/jpeg', 'unclear'],
            ['jpeg-camera.jpg', 'image/jpeg', 'none'],
            ['webp-exif-midjourney.webp', 'image/webp', 'ai'],
        ];
        foreach ($cases as $i => [$file, $mime, $verdict]) {
            klarbild_wp_post($i + 1, $mime, self::FIXTURES . $file);
            $this->assertSame($verdict, Status::detect($i + 1), $file);
        }
        $this->assertArrayNotHasKey(Status::META_GENERATOR, self::meta(3));
    }

    public function testManualStatusIsNeverOverwrittenByDetection(): void
    {
        klarbild_wp_post(7, 'image/jpeg', self::FIXTURES . 'jpeg-camera.jpg');
        $this->assertTrue(Status::setManual(7, 'ai'));
        Status::detect(7);
        $m = self::meta(7);
        $this->assertSame('ai', $m[Status::META_STATUS]);
        $this->assertSame('manual', $m[Status::META_SOURCE]);
        $this->assertSame('none', $m[Status::META_DETECTED]);
        Status::resetToDetected(7);
        $this->assertSame('none', self::meta(7)[Status::META_STATUS]);
        $this->assertSame('detected', self::meta(7)[Status::META_SOURCE]);
    }

    public function testInvalidManualStatusIsRejected(): void
    {
        klarbild_wp_post(8, 'image/png');
        $this->assertFalse(Status::setManual(8, 'unclear'));
        $this->assertFalse(Status::setManual(8, 'evil'));
        $this->assertSame([], self::meta(8));
    }

    public function testUnsupportedOrMissingFilesAreSkipped(): void
    {
        klarbild_wp_post(9, 'application/pdf', self::FIXTURES . 'jpeg-camera.jpg');
        klarbild_wp_post(10, 'image/jpeg', self::FIXTURES . 'missing.jpg');
        $this->assertSame(null, Status::detect(9));
        $this->assertSame(null, Status::detect(10));
        $this->assertSame([], self::meta(9));
        $this->assertSame([], self::meta(10));
        $this->assertSame(null, Status::get(10)['status']);
    }

    public function testResetWithoutDetectionMeansUnchecked(): void
    {
        klarbild_wp_post(11, 'image/png');
        Status::setManual(11, 'none');
        Status::resetToDetected(11);
        $this->assertSame([], self::meta(11));
    }

    public function testNoneLabelNeverClaimsMoreThanTheMetadataSays(): void
    {
        $this->assertSame('No AI hint', Status::label('none', 'detected'));
        $this->assertSame('No AI image', Status::label('none', 'manual'));
        $this->assertSame('Not checked', Status::label(null));
    }

    public function testColumn(): void
    {
        $lib = new MediaLibrary();
        $this->assertArrayHasKey('klarbild', $lib->addColumn(['title' => 'File']));
        klarbild_wp_post(12, 'image/jpeg', self::FIXTURES . 'jpeg-exif-firefly.jpg');
        Status::detect(12);
        ob_start();
        $lib->renderColumn('klarbild', 12);
        $lib->renderColumn('title', 12);
        $html = (string) ob_get_clean();
        $this->assertStringContainsString('klarbild-status-ai', $html);
        $this->assertStringContainsString('AI-generated', $html);
        $this->assertStringContainsString('Adobe Firefly', $html);
        $this->assertSame(1, substr_count($html, 'klarbild-status '));
    }

    public function testColumnEscapesGenerator(): void
    {
        klarbild_wp_post(13, 'image/png');
        update_post_meta(13, Status::META_STATUS, 'ai');
        update_post_meta(13, Status::META_GENERATOR, '<script>x</script>');
        ob_start();
        (new MediaLibrary())->renderColumn('klarbild', 13);
        $html = (string) ob_get_clean();
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
    }

    public function testFilter(): void
    {
        $_GET['klarbild_status'] = 'ai_partial';
        $this->assertSame('ai_partial', MediaLibrary::currentFilter());
        $_GET['klarbild_status'] = "ai' OR 1=1";
        $this->assertSame('', MediaLibrary::currentFilter());
        $_GET['klarbild_status'] = ['ai'];
        $this->assertSame('', MediaLibrary::currentFilter());

        $this->assertSame([['key' => '_klarbild_status', 'compare' => 'NOT EXISTS']], MediaLibrary::metaQuery('unchecked'));
        $this->assertSame([['key' => '_klarbild_status', 'value' => 'ai', 'compare' => '=']], MediaLibrary::metaQuery('ai'));

        $query = new class {
            public $vars = [];
            public $main = true;

            public function is_main_query()
            {
                return $this->main;
            }

            public function set($key, $value)
            {
                $this->vars[$key] = $value;
            }
        };
        $_GET['klarbild_status'] = 'none';
        $lib = new MediaLibrary();
        $lib->applyFilter($query);
        $this->assertSame(MediaLibrary::metaQuery('none'), $query->vars['meta_query']);

        $other = clone $query;
        $other->vars = [];
        $GLOBALS['pagenow'] = 'edit.php';
        $lib->applyFilter($other);
        $this->assertSame([], $other->vars);
    }

    public function testFilterSelect(): void
    {
        $_GET['klarbild_status'] = 'unclear';
        ob_start();
        (new MediaLibrary())->renderFilter('attachment');
        $html = (string) ob_get_clean();
        $this->assertStringContainsString('name="klarbild_status"', $html);
        $this->assertStringContainsString('value="unclear" selected="selected"', $html);
        $this->assertSame(6, substr_count($html, '<option'));
    }

    public function testBulkActionsRespectRights(): void
    {
        $lib = new MediaLibrary();
        $this->assertArrayHasKey('klarbild_mark_ai', $lib->addBulkActions([]));
        klarbild_wp_post(20, 'image/jpeg');
        klarbild_wp_post(21, 'image/jpeg', '', false);
        klarbild_wp_post(22, 'application/pdf');
        $url = $lib->handleBulkAction('upload.php', 'klarbild_mark_ai', ['20', 21, 22, 999, 'x']);
        $this->assertSame('upload.php?klarbild_marked=1', $url);
        $this->assertSame('ai', self::meta(20)[Status::META_STATUS]);
        $this->assertSame([], self::meta(21));
        $this->assertSame('upload.php?x=1', $lib->handleBulkAction('upload.php?x=1', 'delete', [20]));

        $lib->handleBulkAction('upload.php', 'klarbild_mark_auto', [20]);
        $this->assertSame([], self::meta(20));
    }

    public function testNotice(): void
    {
        $_GET['klarbild_marked'] = '3';
        ob_start();
        (new MediaLibrary())->renderNotice();
        $this->assertStringContainsString('AI status changed for 3 images.', (string) ob_get_clean());
    }

    public function testAttachmentField(): void
    {
        $lib = new MediaLibrary();
        klarbild_wp_post(30, 'image/png', self::FIXTURES . 'png-comfyui.png');
        Status::detect(30);
        $fields = $lib->addField([], (object) ['ID' => 30]);
        $this->assertStringContainsString('name="attachments[30][klarbild]"', $fields['klarbild']['html']);
        $this->assertStringContainsString('Automatic (AI-generated)', $fields['klarbild']['html']);
        $this->assertStringContainsString('ComfyUI', $fields['klarbild']['helps']);

        $lib->saveField(['ID' => 30], ['klarbild' => 'none']);
        $this->assertSame('manual', self::meta(30)[Status::META_SOURCE]);
        $fields = $lib->addField([], (object) ['ID' => 30]);
        $this->assertStringContainsString('value="none" selected="selected"', $fields['klarbild']['html']);

        $lib->saveField(['ID' => 30], ['klarbild' => 'bogus']);
        $this->assertSame('none', self::meta(30)[Status::META_STATUS]);
        $lib->saveField(['ID' => 30], ['klarbild' => '']);
        $this->assertSame('ai', self::meta(30)[Status::META_STATUS]);

        klarbild_wp_post(31, 'image/png', '', false);
        $lib->saveField(['ID' => 31], ['klarbild' => 'ai']);
        $this->assertSame([], self::meta(31));
        $this->assertSame([], $lib->addField([], (object) ['ID' => 0]));
    }
}
