import assert from 'node:assert/strict';
import { test } from 'node:test';

import { withDebugTraceDetail } from './actr-trace-format.ts';

test('withDebugTraceDetail appends sgp when missing', () => {
  const out = withDebugTraceDetail('(sgp :esc t)\n(define-model m)');
  assert.match(out, /\(sgp :trace-detail high\)\s*$/);
});

test('withDebugTraceDetail upgrades an existing trace-detail value', () => {
  const out = withDebugTraceDetail('(sgp :esc t :trace-detail low)');
  assert.match(out, /:trace-detail\s+high/);
  assert.doesNotMatch(out, /:trace-detail\s+low/);
});

test('withDebugTraceDetail leaves high alone', () => {
  const src = '(sgp :esc t :trace-detail high)\n';
  assert.equal(withDebugTraceDetail(src), src);
});
