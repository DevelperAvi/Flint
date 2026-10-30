import assert from 'node:assert/strict';
import {
  formatCount,
  formatDuration,
  getAspectRatioClass,
  extractHashtags,
  truncateText,
  cn,
} from '../src/lib/utils';

console.log('🌐 Running Web Utilities Unit Tests...\n');
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// ── formatCount ─────────────────────────────────────────────────────────────
test('formatCount formats units properly', () => {
  assert.equal(formatCount(42), '42');
  assert.equal(formatCount(1200), '1.2K');
  assert.equal(formatCount(2500000), '2.5M');
});

// ── formatDuration ──────────────────────────────────────────────────────────
test('formatDuration formats seconds to mm:ss', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(360), '6:00');
});

// ── getAspectRatioClass ─────────────────────────────────────────────────────
test('getAspectRatioClass maps aspect ratio keys to Tailwind classes', () => {
  assert.equal(getAspectRatioClass('SQUARE'), 'aspect-square');
  assert.equal(getAspectRatioClass('PORTRAIT'), 'aspect-portrait');
  assert.equal(getAspectRatioClass('REEL'), 'aspect-reel');
  assert.equal(getAspectRatioClass('LANDSCAPE'), 'aspect-landscape');
  assert.equal(getAspectRatioClass('UNKNOWN'), 'aspect-square'); // fallback
});

// ── extractHashtags ─────────────────────────────────────────────────────────
test('extractHashtags extracts unique lowercase hashtags from text', () => {
  const text = 'Exploring the mist #Photography #Travel #photography #vibes';
  const tags = extractHashtags(text);
  assert.deepEqual(tags, ['photography', 'travel', 'vibes']);
});

test('extractHashtags returns empty array if no tags', () => {
  assert.deepEqual(extractHashtags('Just a regular caption without tags'), []);
});

// ── truncateText ────────────────────────────────────────────────────────────
test('truncateText truncates text and appends ellipsis', () => {
  const long = 'This is a very long caption that should be truncated when it exceeds maximum length';
  const truncated = truncateText(long, 20);
  assert.equal(truncated, 'This is a very long…');
  assert.equal(truncateText('Short', 10), 'Short');
});

// ── cn ──────────────────────────────────────────────────────────────────────
test('cn merges conditional and conflicting tailwind classes', () => {
  const result = cn('px-4 py-2', false && 'hidden', 'px-6');
  assert.equal(result, 'py-2 px-6');
});

console.log(`\n================================`);
console.log(`Web tests finished: ${passed} passed, ${failed} failed`);
console.log(`================================\n`);

if (failed > 0) {
  process.exit(1);
}

