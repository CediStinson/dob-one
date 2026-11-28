<?php

use Klarbild\Detect\Detector;
use Klarbild\Detect\Fields;
use PHPUnit\Framework\TestCase;

/**
 * PHP and TypeScript give the same result for every case in the shared list
 * (packages/detect/fixtures/expected.json, written by packages/detect/test/expected.test.ts).
 */
final class ParityTest extends TestCase
{
    private const FIXTURES = __DIR__ . '/../../../packages/detect/fixtures/';

    public function testSameResultAsTypeScript(): void
    {
        $cases = json_decode((string) file_get_contents(self::FIXTURES . 'expected.json'), true);
        $this->assertTrue(is_array($cases) && count($cases) > 200, 'expected.json missing or too short');
        $bytesByFile = [];
        foreach ($cases as $case) {
            $file = $case['file'];
            if (!isset($bytesByFile[$file])) {
                $bytesByFile[$file] = (string) file_get_contents(self::FIXTURES . $file);
            }
            $bytes = $case['length'] === null ? $bytesByFile[$file] : substr($bytesByFile[$file], 0, $case['length']);
            $label = $file . ' @ ' . ($case['length'] === null ? 'full' : $case['length']);
            $this->assertSame(json_encode($case['result']), json_encode(Detector::detect($bytes)), $label);
        }
    }

    public function testSameFieldRulesAsTypeScript(): void
    {
        $fields = json_decode((string) file_get_contents(self::FIXTURES . 'expected-fields.json'), true);
        $this->assertCount(53, $fields['generators']);
        foreach ($fields['generators'] as $g) {
            $this->assertSame($g['generator'], Fields::matchGenerator($g['value']), $g['value']);
        }
        foreach ($fields['sourceTypes'] as $st) {
            $this->assertSame(['code' => $st['code'], 'meaning' => $st['meaning']], Fields::classifySourceType($st['value']), $st['value']);
        }
    }

    public function testDetectFileReadsOnlyTheStart(): void
    {
        $r = Detector::detectFile(self::FIXTURES . 'c2pa-org/adobe-20220124-CA.jpg');
        $this->assertSame('unclear', $r['verdict']);
        $this->assertSame(null, Detector::detectFile(self::FIXTURES . 'does-not-exist.jpg'));
    }

    public function testNeverThrowsOnNoise(): void
    {
        $noise = '';
        for ($i = 0; $i < 4096; $i++) {
            $noise .= chr((($i * 2654435761) >> 24) & 0xFF);
        }
        $this->assertSame('none', Detector::detect('')['verdict']);
        $this->assertSame('unknown', Detector::detect($noise)['format']);
        foreach (["\xFF\xD8\xFF\xE1\xFF\xFF", "\x89PNG\r\n\x1A\n\xFF\xFF\xFF\xFFtEXt", "RIFF\0\0\0\0WEBPXMP \xFF\xFF\xFF\xFF"] as $head) {
            $this->assertSame('none', Detector::detect($head . $noise)['verdict']);
        }
    }

    public function testXmpFallbackInUnknownFormat(): void
    {
        $xmp = (string) file_get_contents(self::FIXTURES . 'jpeg-xmp-attr.jpg');
        $this->assertSame('ai', Detector::detect("\0\0\0\x1cftypheic" . $xmp)['verdict']);
    }
}
