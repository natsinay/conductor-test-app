import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STAGES,
  STAGE_IDS,
  getStage,
  isGate,
  nextStage,
  evaluateRun,
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
