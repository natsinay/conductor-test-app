import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STAGES,
  STAGE_IDS,
  getStage,
  isGate,
  nextStage,
  evaluateRun,
  getFooterYear,
  handlePipelineShortcutKey,
  slugify,
} from '../pipeline.js';

test('STAGES lists the six pipeline stages in order', () => {
  assert.deepEqual(STAGE_IDS, [
    'spec-gate',
    'build',
    'advisory-review',
    'execution-gate',
    'merge-gate',
    'promote',
  ]);
  assert.equal(STAGES.length, 6);
});

test('advisory-review is the only non-blocking stage', () => {
  const advisory = STAGES.filter((s) => !s.gate);
  assert.deepEqual(
    advisory.map((s) => s.id),
    ['advisory-review'],
  );
});

test('getStage returns the definition or undefined', () => {
  assert.equal(getStage('build').name, 'Build');
  assert.equal(getStage('nope'), undefined);
});

test('isGate reflects the gate flag', () => {
  assert.equal(isGate('spec-gate'), true);
  assert.equal(isGate('advisory-review'), false);
  assert.equal(isGate('unknown'), false);
});

test('nextStage walks the pipeline and ends at null', () => {
  assert.equal(nextStage('spec-gate'), 'build');
  assert.equal(nextStage('merge-gate'), 'promote');
  assert.equal(nextStage('promote'), null);
});

test('nextStage throws on an unknown stage', () => {
  assert.throws(() => nextStage('bogus'), /Unknown stage/);
});

test('a clean run passes all stages', () => {
  const result = evaluateRun();
  assert.equal(result.status, 'passed');
  assert.equal(result.reached, 'promote');
  assert.equal(result.blockedAt, null);
  assert.deepEqual(result.advisories, []);
  assert.equal(result.stages.length, 6);
});

test('a failing gate blocks the run at that stage', () => {
  const result = evaluateRun({ build: 'fail' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.blockedAt, 'build');
  assert.equal(result.reached, 'build');
  // Nothing after the blocking gate is evaluated.
  assert.deepEqual(
    result.stages.map((s) => s.id),
    ['spec-gate', 'build'],
  );
});

test('an advisory failure is recorded but does not block', () => {
  const result = evaluateRun({ 'advisory-review': 'fail' });
  assert.equal(result.status, 'passed');
  assert.equal(result.blockedAt, null);
  assert.deepEqual(result.advisories, ['advisory-review']);
  assert.equal(result.reached, 'promote');
});

test('the first failing gate wins even if later gates would also fail', () => {
  const result = evaluateRun({ 'execution-gate': 'fail', 'merge-gate': 'fail' });
  assert.equal(result.blockedAt, 'execution-gate');
  assert.equal(result.reached, 'execution-gate');
});

test('skip is a valid, non-blocking outcome for a gate', () => {
  const result = evaluateRun({ 'execution-gate': 'skip' });
  assert.equal(result.status, 'passed');
  assert.equal(result.reached, 'promote');
});

test('an invalid outcome throws', () => {
  assert.throws(() => evaluateRun({ build: 'maybe' }), /Invalid outcome/);
});

test('getFooterYear returns the current four-digit year as a string', () => {
  const year = getFooterYear();
  assert.equal(typeof year, 'string');
  assert.match(year, /^\d{4}$/);
  assert.equal(year, String(new Date().getFullYear()));
});

test('handlePipelineShortcutKey function exists and is a function', () => {
  assert.equal(typeof handlePipelineShortcutKey, 'function');
});

test('handlePipelineShortcutKey responds to T and t keys with mock document', () => {
  // Create a mock document with the pipeline-heading element
  let scrolledElement = null;
  const mockDocument = {
    getElementById: (id) => {
      if (id === 'pipeline-heading') {
        return {
          scrollIntoView: (options) => {
            scrolledElement = { id, options };
          },
        };
      }
      return null;
    },
  };

  // Test lowercase 't'
  const mockEventLower = { key: 't', target: { tagName: 'DIV' } };
  handlePipelineShortcutKey(mockEventLower, { document: mockDocument });
  assert.ok(scrolledElement, 'Should have scrolled for lowercase t');
  assert.equal(scrolledElement.id, 'pipeline-heading');
  assert.deepEqual(scrolledElement.options, { behavior: 'smooth' });

  // Reset and test uppercase 'T'
  scrolledElement = null;
  const mockEventUpper = { key: 'T', target: { tagName: 'DIV' } };
  handlePipelineShortcutKey(mockEventUpper, { document: mockDocument });
  assert.ok(scrolledElement, 'Should have scrolled for uppercase T');
});

test('handlePipelineShortcutKey ignores keypresses in input fields', () => {
  let scrolled = false;
  const mockDocument = {
    getElementById: () => {
      scrolled = true;
      return { scrollIntoView: () => {} };
    },
  };

  const mockEventInput = { key: 't', target: { tagName: 'INPUT' } };
  handlePipelineShortcutKey(mockEventInput, { document: mockDocument });
  assert.equal(scrolled, false, 'Should not scroll when focused on INPUT');

  const mockEventTextarea = { key: 'T', target: { tagName: 'TEXTAREA' } };
  handlePipelineShortcutKey(mockEventTextarea, { document: mockDocument });
  assert.equal(scrolled, false, 'Should not scroll when focused on TEXTAREA');
});

test('handlePipelineShortcutKey ignores other keys', () => {
  let scrolled = false;
  const mockDocument = {
    getElementById: () => {
      scrolled = true;
      return { scrollIntoView: () => {} };
    },
  };

  const mockEventOther = { key: 'x', target: { tagName: 'DIV' } };
  handlePipelineShortcutKey(mockEventOther, { document: mockDocument });
  assert.equal(scrolled, false, 'Should not scroll for other keys');
});

// ============================================
// SLUGIFY TESTS
// ============================================

test('slugify converts text to lowercase', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
  assert.equal(slugify('HELLO WORLD'), 'hello-world');
  assert.equal(slugify('HeLLo WoRLD'), 'hello-world');
});

test('slugify trims leading and trailing whitespace', () => {
  assert.equal(slugify('  hello world  '), 'hello-world');
  assert.equal(slugify('\thello world\t'), 'hello-world');
  assert.equal(slugify('\nhello world\n'), 'hello-world');
});

test('slugify replaces runs of non-alphanumeric characters with single hyphens', () => {
  assert.equal(slugify('hello world'), 'hello-world');
  assert.equal(slugify('hello   world'), 'hello-world');
  assert.equal(slugify('hello---world'), 'hello-world');
  assert.equal(slugify('hello   ---   world'), 'hello-world');
});

test('slugify handles punctuation correctly', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
  assert.equal(slugify('What? Why! How...'), 'what-why-how');
  assert.equal(slugify('foo@bar.com'), 'foo-bar-com');
  assert.equal(slugify('a (b) [c] {d}'), 'a-b-c-d');
});

test('slugify strips leading and trailing hyphens', () => {
  assert.equal(slugify('---hello world---'), 'hello-world');
  assert.equal(slugify('!!!hello world!!!'), 'hello-world');
  assert.equal(slugify('   hello world   '), 'hello-world');
  assert.equal(slugify('-hello world-'), 'hello-world');
});

test('slugify handles mixed punctuation and whitespace', () => {
  assert.equal(slugify(' Hello, World! '), 'hello-world');
  assert.equal(slugify('  ---  Hello, World!  ---  '), 'hello-world');
  assert.equal(slugify('...test...'), 'test');
});

test('slugify preserves numbers', () => {
  assert.equal(slugify('Test 123'), 'test-123');
  assert.equal(slugify('Version 2.0'), 'version-2-0');
  assert.equal(slugify('Item #5'), 'item-5');
});

test('slugify handles single word input', () => {
  assert.equal(slugify('Hello'), 'hello');
  assert.equal(slugify('  Hello  '), 'hello');
  assert.equal(slugify('!!!Hello!!!'), 'hello');
});

test('slugify handles empty and whitespace-only strings', () => {
  assert.equal(slugify(''), '');
  assert.equal(slugify('   '), '');
  assert.equal(slugify('\t\n'), '');
});

test('slugify handles strings that become empty after processing', () => {
  assert.equal(slugify('!!!'), '');
  assert.equal(slugify('---'), '');
  assert.equal(slugify('...'), '');
});

test('slugify produces valid HTML id attributes', () => {
  // IDs must start with a letter, but slugify doesn't enforce this
  // It just ensures no leading/trailing hyphens and no consecutive hyphens
  assert.match(slugify('Hello World'), /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.match(slugify('Test 123 ABC'), /^[a-z0-9]+(-[a-z0-9]+)*$/);
});
