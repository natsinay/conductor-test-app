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
  formatDuration,
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

// formatDuration tests

test('formatDuration returns "0s" for zero', () => {
  assert.equal(formatDuration(0), '0s');
});

test('formatDuration formats sub-minute durations', () => {
  assert.equal(formatDuration(45), '45s');
  assert.equal(formatDuration(1), '1s');
  assert.equal(formatDuration(59), '59s');
});

test('formatDuration formats exact minute durations', () => {
  assert.equal(formatDuration(60), '1m');
  assert.equal(formatDuration(120), '2m');
  assert.equal(formatDuration(300), '5m');
});

test('formatDuration formats minute + seconds durations', () => {
  assert.equal(formatDuration(90), '1m 30s');
  assert.equal(formatDuration(61), '1m 1s');
  assert.equal(formatDuration(119), '1m 59s');
  assert.equal(formatDuration(150), '2m 30s');
});

test('formatDuration formats hour durations with zero-padded minutes', () => {
  assert.equal(formatDuration(3661), '1h 01m');
  assert.equal(formatDuration(3600), '1h 00m');
  assert.equal(formatDuration(3665), '1h 01m');
  assert.equal(formatDuration(3720), '1h 02m');
  assert.equal(formatDuration(7200), '2h 00m');
  assert.equal(formatDuration(7320), '2h 02m');
});
