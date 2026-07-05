// pipeline.js — a small, dependency-free model of the Conductor pipeline.
//
// The Conductor pipeline moves a change through a fixed sequence of stages.
// Some stages are *gates*: they can block progress. One stage (advisory
// review) is non-blocking — it annotates the run but never stops it.
//
// This module is a plain ES module so it can be imported by index.html
// (via <script type="module">) and by the Node test runner alike.

/**
 * The ordered stages of the Conductor pipeline.
 * `gate: true`  -> a failing/blocked stage stops the run.
 * `gate: false` -> the stage is advisory and never blocks.
 */
export const STAGES = [
  {
    id: 'spec-gate',
    name: 'Spec Gate',
    gate: true,
    summary: 'Confirms the change has an approved spec before any work starts.',
  },
  {
    id: 'build',
    name: 'Build',
    gate: true,
    summary: 'Compiles the change and runs the automated test suite.',
  },
  {
    id: 'advisory-review',
    name: 'Advisory Review',
    gate: false,
    summary: 'Surfaces non-blocking suggestions and risks for humans to weigh.',
  },
  {
    id: 'execution-gate',
    name: 'Execution Gate',
    gate: true,
    summary: 'Approves running the change against real, live resources.',
  },
  {
    id: 'merge-gate',
    name: 'Merge Gate',
    gate: true,
    summary: 'Final human sign-off before the change lands on the main line.',
  },
  {
    id: 'promote',
    name: 'Promote',
    gate: true,
    summary: 'Rolls the merged change out to the production environment.',
  },
];

/** Stage ids in pipeline order. */
export const STAGE_IDS = STAGES.map((s) => s.id);

/** Look up a stage definition by id. Returns undefined if unknown. */
export function getStage(id) {
  return STAGES.find((s) => s.id === id);
}

/** True when a stage exists and is a blocking gate. */
export function isGate(id) {
  const stage = getStage(id);
  return Boolean(stage && stage.gate);
}

/**
 * Given a stage id, return the id of the next stage, or null if it is the
 * last stage. Throws on an unknown id so typos fail loudly.
 */
export function nextStage(id) {
  const index = STAGE_IDS.indexOf(id);
  if (index === -1) throw new Error(`Unknown stage: ${id}`);
  return index === STAGE_IDS.length - 1 ? null : STAGE_IDS[index + 1];
}

/**
 * Returns the current four-digit calendar year as a string.
 * Used by the page footer ("Built by Conductor · <year>") and tested
 * independently so the logic is always verifiable.
 *
 * @returns {string} e.g. "2025"
 */
export function getFooterYear() {
  return String(new Date().getFullYear());
}

/**
 * Determines whether the "Back to top" button should be visible.
 * The button should appear when the user has scrolled past 300px.
 *
 * @param {number} scrollY - The current vertical scroll position in pixels
 * @returns {boolean} True when scrollY > 300, false otherwise
 */
export function shouldShowBackToTop(scrollY) {
  return scrollY > 300;
}

/**
 * Keyboard event handler for the pipeline shortcut key.
 * When the user presses 'T' (or 't'), scrolls to the pipeline section.
 *
 * @param {KeyboardEvent} event - The keydown event
 * @param {Object} [options] - Optional dependencies for testing
 * @param {Document} [options.document] - Document object (defaults to global)
 * @returns {void}
 */
export function handlePipelineShortcutKey(event, options = {}) {
  // Only respond to 'T' or 't' key presses
  if (event.key !== 'T' && event.key !== 't') {
    return;
  }

  // Don't trigger if user is typing in an input field
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  // Use provided document or global document (for Node.js test compatibility)
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) {
    return;
  }

  const pipelineHeading = doc.getElementById('pipeline-heading');
  if (pipelineHeading) {
    pipelineHeading.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Evaluate a run through the pipeline.
 *
 * @param {Record<string, ('pass'|'fail'|'skip')>} results
 *        Map of stage id -> outcome. Missing stages are treated as 'pass'.
 * @returns {{
 *   status: 'passed'|'blocked',
 *   reached: string,          // id of the furthest stage evaluated
 *   blockedAt: string|null,   // gate id that stopped the run, or null
 *   advisories: string[],     // ids of advisory stages that reported issues
 *   stages: Array<{ id: string, outcome: string, blocked: boolean }>,
 * }}
 *
 * Rules:
 *  - Stages run in fixed order.
 *  - A blocking gate with outcome 'fail' stops the run at that stage.
 *  - An advisory stage never stops the run; a 'fail' is recorded as an advisory.
 *  - An unknown outcome value throws.
 */
export function evaluateRun(results = {}) {
  const valid = new Set(['pass', 'fail', 'skip']);
  const stages = [];
  const advisories = [];
  let blockedAt = null;
  let reached = null;

  for (const stage of STAGES) {
    const outcome = Object.prototype.hasOwnProperty.call(results, stage.id)
      ? results[stage.id]
      : 'pass';
    if (!valid.has(outcome)) {
      throw new Error(`Invalid outcome for ${stage.id}: ${outcome}`);
    }

    reached = stage.id;

    if (!stage.gate) {
      if (outcome === 'fail') advisories.push(stage.id);
      stages.push({ id: stage.id, outcome, blocked: false });
      continue;
    }

    const blocked = outcome === 'fail';
    stages.push({ id: stage.id, outcome, blocked });

    if (blocked) {
      blockedAt = stage.id;
      break;
    }
  }

  return {
    status: blockedAt ? 'blocked' : 'passed',
    reached,
    blockedAt,
    advisories,
    stages,
  };
}

/**
 * Toggles between light and dark theme.
 * Persists the preference in localStorage.
 *
 * @param {Object} [options] - Optional dependencies for testing
 * @param {Document} [options.document] - Document object (defaults to global)
 * @param {Storage} [options.storage] - Storage object (defaults to localStorage)
 * @returns {string} The new theme ('light' or 'dark')
 */
export function toggleTheme(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  
  if (!doc) {
    return 'dark';
  }
  
  const currentTheme = doc.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  doc.documentElement.setAttribute('data-theme', newTheme);
  
  if (storage) {
    storage.setItem('theme', newTheme);
  }
  
  return newTheme;
}

/**
 * Gets the current theme from the document or storage.
 *
 * @param {Object} [options] - Optional dependencies for testing
 * @param {Document} [options.document] - Document object (defaults to global)
 * @param {Storage} [options.storage] - Storage object (defaults to localStorage)
 * @returns {string} The current theme ('light' or 'dark')
 */
export function getCurrentTheme(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  
  // Check document first
  if (doc && doc.documentElement.hasAttribute('data-theme')) {
    return doc.documentElement.getAttribute('data-theme');
  }
  
  // Check storage
  if (storage) {
    const stored = storage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  }
  
  // Default to dark
  return 'dark';
}

/**
 * Validates an email address format.
 *
 * @param {string} email - The email address to validate
 * @returns {boolean} True if the email is valid, false otherwise
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Simple email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates a customer name.
 *
 * @param {string} name - The name to validate
 * @returns {boolean} True if the name is valid, false otherwise
 */
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}

/**
 * Validates customer onboarding form data.
 *
 * @param {Object} data - Form data object
 * @param {string} data.name - Customer name
 * @param {string} data.email - Customer email
 * @returns {{ valid: boolean, errors: Record<string, string> }} Validation result
 */
export function validateOnboardingForm(data) {
  const errors = {};
  
  if (!validateName(data.name)) {
    errors.name = 'Please enter a valid name (2-100 characters)';
  }
  
  if (!validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
