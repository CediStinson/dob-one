<?php

use Klarbild\Detect\Detector;
use Klarbild\Embed\Embedder;
use Klarbild\Embed\Writer;
use Klarbild\Media\Status;
use Klarbild\Settings;
use PHPUnit\Framework\TestCase;

final class EmbedTest extends TestCase
{
    private const FIXTURES = __DIR__ . '/../../../packages/detect/fixtures/';

    /** @var string */
    private $dir = '';

    protected function setUp(): void
    {
        klarbild_wp_reset();
        $this->dir = sys_get_temp_dir() . '/klarbild-test-' . bin2hex(random_bytes(4));
        mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        foreach ((array) glob($this->dir . '/*') as $file) {
            unlink((string) $file);
        }
        if (is_dir($this->dir)) {
            rmdir($this->dir);
        }
    }

    private static function fixture(string $name): string
    {
        return (string) file_get_contents(self::FIXTURES . $name);
    }

    /** Images written by GD, like WordPress creates sizes on many hosts. */
    private static function gd(string $format, bool $alpha = false): string
    {
        $im = imagecreatetruecolor(40, 24);
        imagesavealpha($im, $alpha);
        imagealphablending($im, !$alpha);
        imagefill($im, 0, 0, imagecolorallocatealpha($im, 0, 128, 128, $alpha ? 60 : 0));
        ob_start();
        if ($format === 'jpeg') {
            imagejpeg($im, null, 80);
        } elseif ($format === 'png') {
            imagepng($im);
        } elseif ($format === 'webp-lossless') {
            imagewebp($im, null, defined('IMG_WEBP_LOSSLESS') ? IMG_WEBP_LOSSLESS : 101);
        } else {
            imagewebp($im, null, 80);
        }
        return (string) ob_get_clean();
    }

    public function testSamePacketAsTypeScript(): void
    {
        $fields = json_decode(self::fixture('expected-fields.json'), true);
        foreach ([Embedder::GENERATED, Embedder::COMPOSITE] as $type) {
            $this->assertSame($fields['xmp'][$type], Embedder::buildXmp($type), $type);
        }
    }

    public function testSourceTypeForStatus(): void
    {
        $this->assertSame(Embedder::GENERATED, Embedder::sourceTypeFor('ai'));
        $this->assertSame(Embedder::COMPOSITE, Embedder::sourceTypeFor('ai_partial'));
        $this->assertSame(null, Embedder::sourceTypeFor('unclear'));
        $this->assertSame(null, Embedder::sourceTypeFor('none'));
        $this->assertSame(null, Embedder::sourceTypeFor(null));
        $this->assertSame(null, Embedder::embed(self::fixture('jpeg-camera.jpg'), 'digitalCapture'));
    }

    public function testRoundtripOnAllFixtures(): void
    {
        $files = ['jpeg-camera.jpg', 'jpeg-c2pa-camera.jpg', 'jpeg-exif-firefly.jpg', 'jpeg-xmp-google.jpg', 'jpeg-xmp-attr.jpg',
            'png-plain.png', 'png-a1111.png', 'png-xmp-composite.png', 'webp-xmp.webp', 'webp-exif-midjourney.webp',
            'c2pa-org/adobe-20220124-A.jpg'];
        foreach ($files as $file) {
            $src = self::fixture($file);
            foreach ([Embedder::GENERATED, Embedder::COMPOSITE] as $type) {
                $out = Embedder::embed($src, $type);
                $this->assertTrue(is_string($out), "$file $type");
                $this->assertTrue(Embedder::hasSourceType($out, $type), "$file $type");
                $this->assertSame(\Klarbild\Detect\Containers::sniff($src), Detector::detect($out)['format'], $file);
                // Exactly one XMP packet, also when the file had one before.
                $this->assertSame(1, substr_count($out, '<x:xmpmeta'), "$file $type");
                // Embedding again changes nothing.
                $this->assertSame($out, Embedder::embed($out, $type), "$file $type twice");
            }
        }
    }

    public function testExistingXmpIsKept(): void
    {
        // Google fixture: rdf:resource form plus photoshop:Credit.
        $out = (string) Embedder::embed(self::fixture('jpeg-xmp-google.jpg'), Embedder::COMPOSITE);
        $this->assertStringContainsString('<photoshop:Credit>Made with Google AI</photoshop:Credit>', $out);
        $this->assertStringContainsString('rdf:resource="http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia"', $out);
        // Element form.
        $out = (string) Embedder::embed(self::fixture('png-xmp-composite.png'), Embedder::GENERATED);
        $this->assertSame('ai', Detector::detect($out)['verdict']);
        $this->assertStringNotContainsString('compositeWithTrainedAlgorithmicMedia', $out);
        // Attribute form.
        $out = (string) Embedder::embed(self::fixture('jpeg-xmp-attr.jpg'), Embedder::COMPOSITE);
        $this->assertSame('ai_partial', Detector::detect($out)['verdict']);
    }

    public function testMergeAddsOwnDescription(): void
    {
        $xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
            . '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:rights>© Studio</dc:rights></rdf:Description>'
            . '</rdf:RDF></x:xmpmeta>';
        $merged = (string) Embedder::mergeXmp($xmp, Embedder::GENERATED);
        $this->assertStringContainsString('<dc:rights>© Studio</dc:rights>', $merged);
        $this->assertSame(2, substr_count($merged, '<rdf:Description'));
        $this->assertTrue(simplexml_load_string($merged) !== false);
        $this->assertSame(null, Embedder::mergeXmp('<x:xmpmeta>broken', Embedder::GENERATED));
    }

    public function testGdImagesStayValid(): void
    {
        if (!function_exists('imagecreatetruecolor') || !function_exists('imagewebp')) {
            $this->assertTrue(true);
            return;
        }
        foreach ([['jpeg', false], ['png', false], ['png', true], ['webp', false], ['webp', true], ['webp-lossless', false], ['webp-lossless', true]] as [$format, $alpha]) {
            $label = $format . ($alpha ? ' alpha' : '');
            $src = self::gd($format, $alpha);
            $this->assertSame('none', Detector::detect($src)['verdict'], $label);
            $out = Embedder::embed($src, Embedder::GENERATED);
            $this->assertTrue(is_string($out), $label);
            $this->assertSame('ai', Detector::detect((string) $out)['verdict'], $label);
            $size = getimagesizefromstring((string) $out);
            $this->assertSame([40, 24], [$size[0], $size[1]], $label);
            $im = @imagecreatefromstring((string) $out);
            $this->assertTrue($im !== false, $label . ' decodes');
            if ($alpha) {
                $this->assertTrue((imagecolorat($im, 1, 1) >> 24) > 0, $label . ' keeps alpha');
            }
        }
    }

    public function testBrokenInputIsLeftAlone(): void
    {
        $jpeg = self::fixture('jpeg-camera.jpg');
        $this->assertSame(null, Embedder::embed(substr($jpeg, 0, 30), Embedder::GENERATED));
        $this->assertSame(null, Embedder::embed('', Embedder::GENERATED));
        $this->assertSame(null, Embedder::embed('GIF89a' . str_repeat("\0", 20), Embedder::GENERATED));
        $png = self::fixture('png-plain.png');
        $this->assertSame(null, Embedder::embed(substr($png, 0, strlen($png) - 5), Embedder::GENERATED));
    }

    private function attachment(int $id, string $status): array
    {
        $camera = self::fixture('jpeg-camera.jpg');
        foreach (['photo.jpg', 'photo-scaled.jpg', 'photo-150x150.jpg', 'photo-300x180.jpg'] as $name) {
            file_put_contents($this->dir . '/' . $name, $camera);
        }
        file_put_contents($this->dir . '/photo-300x180.webp', self::fixture('webp-exif-midjourney.webp'));
        file_put_contents($this->dir . '/secret.jpg', $camera);
        klarbild_wp_post($id, 'image/jpeg', $this->dir . '/photo-scaled.jpg');
        // Original kept by big image scaling.
        $GLOBALS['klarbild_wp']['posts'][$id]['original'] = $this->dir . '/photo.jpg';
        update_post_meta($id, Status::META_STATUS, $status);
        return [
            'file' => 'photo-scaled.jpg',
            'original_image' => 'photo.jpg',
            'sizes' => [
                'thumbnail' => ['file' => 'photo-150x150.jpg'],
                'medium' => ['file' => 'photo-300x180.jpg', 'sources' => ['image/webp' => ['file' => 'photo-300x180.webp']]],
                'evil' => ['file' => '../secret.jpg'],
                'missing' => ['file' => 'photo-1x1.jpg'],
            ],
        ];
    }

    public function testWriterCoversAllSizesButNeverTheOriginal(): void
    {
        $metadata = $this->attachment(40, 'ai');
        $original = (string) file_get_contents($this->dir . '/photo.jpg');
        $files = Writer::generatedFiles(40, $metadata);
        $this->assertSame(['photo-scaled.jpg', 'photo-150x150.jpg', 'photo-300x180.jpg', 'photo-300x180.webp', 'photo-1x1.jpg'], array_map('basename', $files));

        $this->assertSame(['written' => 4, 'skipped' => 1], Writer::writeAttachment(40, $metadata));
        foreach (['photo-scaled.jpg', 'photo-150x150.jpg', 'photo-300x180.jpg', 'photo-300x180.webp'] as $name) {
            $this->assertTrue(Embedder::hasSourceType((string) file_get_contents($this->dir . '/' . $name), Embedder::GENERATED), $name);
        }
        $this->assertSame($original, (string) file_get_contents($this->dir . '/photo.jpg'));
        $this->assertSame('none', Detector::detect((string) file_get_contents($this->dir . '/secret.jpg'))['verdict']);
        $this->assertSame([], (array) glob($this->dir . '/*.tmp'));
        // Second run: already there, nothing to change.
        $this->assertSame(['written' => 4, 'skipped' => 1], Writer::writeAttachment(40, $metadata));
    }

    public function testWriterRespectsStatusAndSetting(): void
    {
        $metadata = $this->attachment(41, 'none');
        $this->assertSame(['written' => 0, 'skipped' => 0], Writer::writeAttachment(41, $metadata));
        update_post_meta(41, Status::META_STATUS, 'unclear');
        $this->assertSame(['written' => 0, 'skipped' => 0], Writer::writeAttachment(41, $metadata));
        update_post_meta(41, Status::META_STATUS, 'ai_partial');
        $GLOBALS['klarbild_wp']['options'][Settings::OPTION] = ['write_iptc' => false] + Settings::defaults();
        $this->assertSame(['written' => 0, 'skipped' => 0], Writer::writeAttachment(41, $metadata));
        $GLOBALS['klarbild_wp']['options'] = [];
        $this->assertSame(4, Writer::writeAttachment(41, $metadata)['written']);
        $this->assertSame('ai_partial', Detector::detect((string) file_get_contents($this->dir . '/photo-150x150.jpg'))['verdict']);
    }

    public function testWithoutScalingTheAttachedFileIsTheOriginal(): void
    {
        $metadata = $this->attachment(42, 'ai');
        unset($metadata['original_image']);
        $GLOBALS['klarbild_wp']['posts'][42]['file'] = $this->dir . '/photo.jpg';
        $GLOBALS['klarbild_wp']['posts'][42]['original'] = $this->dir . '/photo.jpg';
        $names = array_map('basename', Writer::generatedFiles(42, $metadata));
        $this->assertTrue(!in_array('photo.jpg', $names, true));
        $this->assertTrue(!in_array('photo-scaled.jpg', $names, true));
    }

    public function testManualChangeWritesTheSizes(): void
    {
        $metadata = $this->attachment(43, 'none');
        $GLOBALS['klarbild_wp']['posts'][43]['metadata'] = $metadata;
        $GLOBALS['klarbild_wp']['posts'][43]['meta'][Status::META_DETECTED] = 'none';
        (new \Klarbild\Admin\MediaLibrary())->handleBulkAction('upload.php', 'klarbild_mark_ai', [43]);
        $this->assertTrue(Embedder::hasSourceType((string) file_get_contents($this->dir . '/photo-150x150.jpg'), Embedder::GENERATED));
    }
}
