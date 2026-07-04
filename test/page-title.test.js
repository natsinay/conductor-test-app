import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('rendered page title is Maestro', () => {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf-8');
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  assert.ok(titleMatch, 'title tag should exist in index.html');
  const title = titleMatch[1];
  assert.equal(title, 'Maestro — the change pipeline');
});

test('footer credit retains Conductor for integration contract', () => {
  const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf-8');
  assert.ok(
    html.includes('Built by Conductor'),
    'footer should contain "Built by Conductor" for integration contract'
  );
});
