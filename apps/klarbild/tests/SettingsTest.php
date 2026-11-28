<?php

use Klarbild\Settings;
use PHPUnit\Framework\TestCase;

final class SettingsTest extends TestCase
{
    protected function setUp(): void
    {
        klarbild_wp_reset();
    }

    public function testDefaultsAreSafe(): void
    {
        $d = Settings::defaults();
        $this->assertTrue($d['overlay']);
        $this->assertSame('bottom-right', $d['overlay_position']);
        $this->assertFalse($d['alt_suffix']);
        $this->assertSame('KI-generiert', $d['alt_suffix_text']);
        $this->assertTrue($d['write_iptc']);
    }

    public function testNonArrayInputGivesDefaults(): void
    {
        $this->assertSame(Settings::defaults(), Settings::sanitize(null));
        $this->assertSame(Settings::defaults(), Settings::sanitize('overlay=1'));
    }

    public function testMissingCheckboxesMeanOff(): void
    {
        $s = Settings::sanitize([]);
        $this->assertFalse($s['overlay']);
        $this->assertFalse($s['alt_suffix']);
        $this->assertFalse($s['write_iptc']);
    }

    public function testCheckboxValues(): void
    {
        $s = Settings::sanitize(['overlay' => '1', 'alt_suffix' => 'on', 'write_iptc' => 'yes']);
        $this->assertTrue($s['overlay']);
        $this->assertTrue($s['alt_suffix']);
        $this->assertFalse($s['write_iptc']);
    }

    public function testUnknownKeysAreDropped(): void
    {
        $s = Settings::sanitize(['overlay' => '1', 'evil' => '<script>']);
        $this->assertArrayNotHasKey('evil', $s);
        $this->assertSame(array_keys(Settings::defaults()), array_keys($s));
    }

    public function testPositionWhitelist(): void
    {
        foreach (Settings::POSITIONS as $p) {
            $this->assertSame($p, Settings::sanitize(['overlay_position' => $p])['overlay_position']);
        }
        $this->assertSame('bottom-right', Settings::sanitize(['overlay_position' => 'center'])['overlay_position']);
        $this->assertSame('bottom-right', Settings::sanitize(['overlay_position' => ['top-left']])['overlay_position']);
    }

    public function testAltTextIsCleaned(): void
    {
        $s = Settings::sanitize(['alt_suffix_text' => "  <b>Mit KI</b>\n\terstellt  "]);
        $this->assertSame('Mit KI erstellt', $s['alt_suffix_text']);
    }

    public function testAltTextLengthIsLimitedByCharacters(): void
    {
        $s = Settings::sanitize(['alt_suffix_text' => str_repeat('ä', 100)]);
        $this->assertSame(Settings::MAX_ALT_SUFFIX, mb_strlen($s['alt_suffix_text'], 'UTF-8'));
    }

    public function testEmptyOrInvalidAltTextFallsBack(): void
    {
        $this->assertSame('KI-generiert', Settings::sanitize(['alt_suffix_text' => '   '])['alt_suffix_text']);
        $this->assertSame('KI-generiert', Settings::sanitize(['alt_suffix_text' => '<i></i>'])['alt_suffix_text']);
        $this->assertSame('KI-generiert', Settings::sanitize(['alt_suffix_text' => "\xC3\x28"])['alt_suffix_text']);
    }

    public function testGetWithoutStoredOption(): void
    {
        $this->assertSame(Settings::defaults(), Settings::get());
    }

    public function testGetSanitizesStoredRows(): void
    {
        $GLOBALS['klarbild_wp']['options'][Settings::OPTION] = [
            'overlay' => false,
            'overlay_position' => 'nowhere',
            'alt_suffix_text' => '<script>x</script>Hinweis',
        ];
        $s = Settings::get();
        $this->assertFalse($s['overlay']);
        $this->assertSame('bottom-right', $s['overlay_position']);
        $this->assertSame('xHinweis', $s['alt_suffix_text']);
        // Missing in the stored row, so the default applies.
        $this->assertTrue($s['write_iptc']);
    }

    public function testGetWithBrokenOption(): void
    {
        $GLOBALS['klarbild_wp']['options'][Settings::OPTION] = 'broken';
        $this->assertSame(Settings::defaults(), Settings::get());
    }
}
