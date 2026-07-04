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
 * Format a duration in seconds into a human-readable string.
 *
 * @param {number} seconds - Duration in seconds (non-negative integer)
 * @returns {string} Formatted duration
 *
 * Examples:
 *   - 0 -> "0s"
 *   - 45 -> "45s"
 *   - 90 -> "1m 30s"
 *   - 3661 -> "1h 01m" (hours zero-pad minutes to 2 digits)
 */
export function formatDuration(seconds) {
  if (seconds === 0) {
    return '0s';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
    // When we have hours, always include minutes (zero-padded to 2 digits)
    parts.push(`${String(minutes).padStart(2, '0')}m`);
  } else if (minutes > 0) {
    parts.push(`${minutes}m`);
    if (secs > 0) {
      parts.push(`${secs}s`);
    }
  } else {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
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
