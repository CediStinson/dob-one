<?php
/**
 * Fallback runner for environments without PHPUnit (Claude's session has no Packagist access).
 * CI runs the same test classes with real PHPUnit. Only the assertions used in tests/ exist here.
 *
 * Usage: php apps/klarbild/tests/run-local.php
 */

namespace PHPUnit\Framework {
    class AssertionFailed extends \Exception
    {
    }

    abstract class TestCase
    {
        /** @var int */
        public $assertions = 0;

        protected function setUp(): void
        {
        }

        protected function tearDown(): void
        {
        }

        public function runTest(string $method): void
        {
            $this->setUp();
            try {
                $this->$method();
            } finally {
                $this->tearDown();
            }
        }

        private function check(bool $ok, string $message, string $extra = ''): void
        {
            $this->assertions++;
            if (!$ok) {
                throw new AssertionFailed($message . ($extra !== '' ? " ($extra)" : ''));
            }
        }

        protected function assertSame($expected, $actual, string $m = ''): void
        {
            $this->check($expected === $actual, 'Failed asserting that ' . var_export($actual, true) . ' is identical to ' . var_export($expected, true), $m);
        }

        protected function assertTrue($actual, string $m = ''): void
        {
            $this->check($actual === true, 'Failed asserting that value is true', $m);
        }

        protected function assertFalse($actual, string $m = ''): void
        {
            $this->check($actual === false, 'Failed asserting that value is false', $m);
        }

        protected function assertCount(int $expected, $actual, string $m = ''): void
        {
            $this->check(count($actual) === $expected, "Failed asserting count $expected, got " . count($actual), $m);
        }

        protected function assertArrayHasKey($key, array $array, string $m = ''): void
        {
            $this->check(array_key_exists($key, $array), "Failed asserting that array has key $key", $m);
        }

        protected function assertArrayNotHasKey($key, array $array, string $m = ''): void
        {
            $this->check(!array_key_exists($key, $array), "Failed asserting that array has no key $key", $m);
        }

        protected function assertStringContainsString(string $needle, string $haystack, string $m = ''): void
        {
            $this->check(strpos($haystack, $needle) !== false, "Failed asserting that string contains '$needle'", $m);
        }

        protected function assertStringNotContainsString(string $needle, string $haystack, string $m = ''): void
        {
            $this->check(strpos($haystack, $needle) === false, "Failed asserting that string does not contain '$needle'", $m);
        }

        protected function assertMatchesRegularExpression(string $pattern, string $string, string $m = ''): void
        {
            $this->check(preg_match($pattern, $string) === 1, "Failed asserting that string matches $pattern", $m);
        }
    }
}

namespace {
    error_reporting(E_ALL);
    set_error_handler(static function ($severity, $message, $file, $line) {
        throw new \ErrorException($message, 0, $severity, $file, $line);
    });

    require __DIR__ . '/bootstrap.php';

    $failed = 0;
    $passed = 0;
    $assertions = 0;
    foreach (glob(__DIR__ . '/*Test.php') as $file) {
        require_once $file;
        $class = basename($file, '.php');
        foreach (get_class_methods($class) as $method) {
            if (strncmp($method, 'test', 4) !== 0) {
                continue;
            }
            $test = new $class();
            ob_start();
            try {
                $test->runTest($method);
                $output = (string) ob_get_clean();
                if ($output !== '') {
                    throw new \RuntimeException('Test printed unexpected output: ' . substr($output, 0, 80));
                }
                if ($test->assertions === 0) {
                    throw new \RuntimeException('Risky: test made no assertions');
                }
                $passed++;
                $assertions += $test->assertions;
            } catch (\Throwable $e) {
                if (ob_get_level() > 0) {
                    ob_end_clean();
                }
                $failed++;
                echo "FAIL $class::$method\n  " . $e->getMessage() . "\n";
            }
        }
    }
    echo "Klarbild: $passed passed, $failed failed, $assertions assertions\n";
    exit($failed > 0 ? 1 : 0);
}
