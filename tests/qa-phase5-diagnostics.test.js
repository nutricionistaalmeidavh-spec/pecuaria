import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const wrapperPath = 'scripts/qa-phase5-release.ps1';

test('phase5 release QA preserves raw diagnostics and fallback summary', () => {
  assert.equal(existsSync(wrapperPath), true, 'scripts/qa-phase5-release.ps1 must exist');
  const wrapper = readFileSync(wrapperPath, 'utf8');
  assert.match(wrapper, /phase5-raw\.log/);
  assert.match(wrapper, /Write-FallbackPhase5Summary/);
  assert.match(wrapper, /lastFailure/);
  assert.match(wrapper, /phase5-summary-missing|phase5-exit-without-diagnostic/);

  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts['phase5:raw'], 'phase5:raw must preserve the original phase5 command');
  assert.match(pkg.scripts.phase5, /qa-phase5-release\.ps1/);

  const release = JSON.parse(readFileSync('.artisys/release.json', 'utf8'));
  assert.match(String(release.steps.qa), /qa-phase5-release\.ps1/);
});
