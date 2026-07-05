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
  shouldShowBackToTop,
  toggleTheme,
  getCurrentTheme,
  validateEmail,
  validateName,
  validateOnboardingForm,
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
// BACK TO TOP VISIBILITY TESTS
// ============================================

test('shouldShowBackToTop returns false at scrollY 0', () => {
  assert.equal(shouldShowBackToTop(0), false);
});

test('shouldShowBackToTop returns false at scrollY 300', () => {
  assert.equal(shouldShowBackToTop(300), false);
});

test('shouldShowBackToTop returns true at scrollY 301', () => {
  assert.equal(shouldShowBackToTop(301), true);
});

// ============================================
// THEME TOGGLE TESTS
// ============================================

test('toggleTheme function exists and is a function', () => {
  assert.equal(typeof toggleTheme, 'function');
});

test('toggleTheme toggles from dark to light with mock document', () => {
  let currentTheme = 'dark';
  const mockDocument = {
    documentElement: {
      getAttribute: () => currentTheme,
      setAttribute: (name, value) => {
        if (name === 'data-theme') currentTheme = value;
      },
    },
  };
  
  const mockStorage = {
    storedValue: null,
    setItem: (key, value) => {
      mockStorage.storedValue = value;
    },
  };
  
  const result = toggleTheme({ document: mockDocument, storage: mockStorage });
  assert.equal(result, 'light');
  assert.equal(currentTheme, 'light');
  assert.equal(mockStorage.storedValue, 'light');
});

test('toggleTheme toggles from light to dark with mock document', () => {
  let currentTheme = 'light';
  const mockDocument = {
    documentElement: {
      getAttribute: () => currentTheme,
      setAttribute: (name, value) => {
        if (name === 'data-theme') currentTheme = value;
      },
    },
  };
  
  const mockStorage = {
    storedValue: null,
    setItem: (key, value) => {
      mockStorage.storedValue = value;
    },
  };
  
  const result = toggleTheme({ document: mockDocument, storage: mockStorage });
  assert.equal(result, 'dark');
  assert.equal(currentTheme, 'dark');
  assert.equal(mockStorage.storedValue, 'dark');
});

test('toggleTheme returns dark when no document is available', () => {
  const result = toggleTheme({});
  assert.equal(result, 'dark');
});

test('getCurrentTheme returns the theme from document', () => {
  const mockDocument = {
    documentElement: {
      hasAttribute: () => true,
      getAttribute: () => 'light',
    },
  };
  
  const result = getCurrentTheme({ document: mockDocument });
  assert.equal(result, 'light');
});

test('getCurrentTheme returns theme from storage when document has no theme', () => {
  const mockDocument = {
    documentElement: {
      hasAttribute: () => false,
    },
  };
  
  const mockStorage = {
    getItem: () => 'dark',
  };
  
  const result = getCurrentTheme({ document: mockDocument, storage: mockStorage });
  assert.equal(result, 'dark');
});

test('getCurrentTheme returns dark as default', () => {
  const result = getCurrentTheme({});
  assert.equal(result, 'dark');
});

// ============================================
// EMAIL VALIDATION TESTS
// ============================================

test('validateEmail returns true for valid email', () => {
  assert.equal(validateEmail('test@example.com'), true);
  assert.equal(validateEmail('user.name@example.org'), true);
  assert.equal(validateEmail('user+tag@example.co.uk'), true);
});

test('validateEmail returns false for invalid email', () => {
  assert.equal(validateEmail('invalid'), false);
  assert.equal(validateEmail('test@'), false);
  assert.equal(validateEmail('@example.com'), false);
  assert.equal(validateEmail('test@example'), false);
  assert.equal(validateEmail(''), false);
  assert.equal(validateEmail(null), false);
  assert.equal(validateEmail(undefined), false);
  assert.equal(validateEmail(123), false);
});

test('validateEmail trims whitespace', () => {
  assert.equal(validateEmail('  test@example.com  '), true);
});

// ============================================
// NAME VALIDATION TESTS
// ============================================

test('validateName returns true for valid names', () => {
  assert.equal(validateName('John Doe'), true);
  assert.equal(validateName('Jane'), true);
  assert.equal(validateName('A B'), true);
  assert.equal(validateName('Very Long Name That Is Still Valid'), true);
});

test('validateName returns false for invalid names', () => {
  assert.equal(validateName('A'), false); // Too short
  assert.equal(validateName(''), false);
  assert.equal(validateName(null), false);
  assert.equal(validateName(undefined), false);
  assert.equal(validateName(123), false);
});

test('validateName returns false for names over 100 characters', () => {
  const longName = 'A'.repeat(101);
  assert.equal(validateName(longName), false);
});

test('validateName trims whitespace', () => {
  assert.equal(validateName('  John Doe  '), true);
});

// ============================================
// ONBOARDING FORM VALIDATION TESTS
// ============================================

test('validateOnboardingForm returns valid for correct data', () => {
  const result = validateOnboardingForm({
    name: 'John Doe',
    email: 'john@example.com',
  });
  
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('validateOnboardingForm returns invalid for missing name', () => {
  const result = validateOnboardingForm({
    name: '',
    email: 'john@example.com',
  });
  
  assert.equal(result.valid, false);
  assert.ok(result.errors.name);
});

test('validateOnboardingForm returns invalid for invalid email', () => {
  const result = validateOnboardingForm({
    name: 'John Doe',
    email: 'invalid-email',
  });
  
  assert.equal(result.valid, false);
  assert.ok(result.errors.email);
});

test('validateOnboardingForm returns multiple errors for invalid data', () => {
  const result = validateOnboardingForm({
    name: '',
    email: 'invalid',
  });
  
  assert.equal(result.valid, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.email);
});
