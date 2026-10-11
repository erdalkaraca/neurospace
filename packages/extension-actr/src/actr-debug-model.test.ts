import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  findProductionRange,
  hoverText,
  parseDebugSnapshot,
  reduceDebugView,
  type DebugView,
  type StepBuffers,
} from './actr-debug-model.ts';

const addition = readFileSync(new URL('../tutorial/unit1/addition.lisp', import.meta.url), 'utf8');
const count = readFileSync(new URL('../tutorial/unit1/count.lisp', import.meta.url), 'utf8');

const goalBuffers: StepBuffers = {
  goal: { arg1: 'five', arg2: 'two' },
  retrieval: null,
};

function selected(name: string, buffers: StepBuffers = goalBuffers): DebugView {
  return reduceDebugView(
    null,
    {
      time: 0,
      module: 'procedural',
      details: `PRODUCTION-SELECTED ${name}`,
      done: false,
      buffers,
    },
    addition,
  );
}

test('parseDebugSnapshot reads a string-only mailbox payload', () => {
  const snap = parseDebugSnapshot({
    time: 0.05,
    module: 'procedural',
    details: 'PRODUCTION-SELECTED INITIALIZE-ADDITION',
    done: false,
    buffers: { goal: { arg1: 'five' }, retrieval: null },
  });
  assert.equal(snap.done, false);
  assert.equal(snap.buffers.goal?.arg1, 'five');
  assert.equal(snap.buffers.retrieval, null);
});

test('finds a production nested inside define-model', () => {
  const range = findProductionRange(addition, 'initialize-addition');
  assert.ok(range);
  const text = addition.slice(range.start, range.end);
  assert.match(text, /^\(P initialize-addition/);
  assert.doesNotMatch(text, /increment-count/);
  assert.equal(addition[range.end - 1], ')');
});

test('selection binds left-hand variables and hover shows buffer slots', () => {
  const view = selected('INITIALIZE-ADDITION');
  assert.equal(view.production, 'INITIALIZE-ADDITION');
  assert.equal(view.bindings['=num1'], 'five');
  assert.equal(view.bindings['=num2'], 'two');
  assert.equal(view.fired, false);

  const range = findProductionRange(addition, 'initialize-addition');
  assert.ok(range);
  const body = addition.slice(range.start, range.end);
  const arg1 = range.start + body.indexOf('arg1');
  const sum = range.start + body.indexOf('sum');
  const num1 = range.start + body.indexOf('=num1');
  const request = range.start + body.indexOf('+retrieval>');

  assert.equal(hoverText(addition, arg1, view), 'arg1 = five');
  assert.equal(hoverText(addition, sum, view), 'sum is absent');
  assert.equal(hoverText(addition, num1, view), '=num1 = five');
  assert.match(hoverText(addition, request, view) ?? '', /^retrieval request$/m);
  assert.match(hoverText(addition, request, view) ?? '', /^number = five$/m);
  assert.equal(hoverText(addition, 0, view), null);
});

test('count start production hovers the goal snapshot', () => {
  const view = reduceDebugView(
    null,
    {
      time: 0.05,
      module: 'procedural',
      details: 'PRODUCTION-SELECTED START',
      done: false,
      buffers: { goal: { start: 'two', end: 'four' }, retrieval: null },
    },
    count,
  );
  assert.equal(view.bindings['=num1'], 'two');
  const range = findProductionRange(count, 'start');
  assert.ok(range);
  const at = (token: string) => range.start + count.slice(range.start, range.end).indexOf(token);
  assert.match(hoverText(count, at('=goal>'), view) ?? '', /^start = two$/m);
  assert.match(hoverText(count, at('=goal>'), view) ?? '', /^end = four$/m);
  assert.equal(hoverText(count, at('start       =num1'), view), 'start = two');
  assert.equal(hoverText(count, at('=num1'), view), '=num1 = two');
  assert.equal(hoverText(count, at('nil'), view), 'count is absent');
  assert.match(hoverText(count, at('+retrieval>'), view) ?? '', /^number = two$/m);
});

test('conflict resolution clears the highlight and a later production replaces it', () => {
  const selectedView = selected('INITIALIZE-ADDITION');
  const cleared = reduceDebugView(
    selectedView,
    {
      time: 0.05,
      module: 'procedural',
      details: 'CONFLICT-RESOLUTION',
      done: false,
      buffers: goalBuffers,
    },
    addition,
  );
  assert.equal(cleared.production, null);

  const next = reduceDebugView(
    cleared,
    {
      time: 0.1,
      module: 'procedural',
      details: 'PRODUCTION-SELECTED INCREMENT-SUM',
      done: false,
      buffers: {
        goal: { arg1: 'five', arg2: 'two', sum: 'five', count: 'zero' },
        retrieval: { number: 'five', next: 'six' },
      },
    },
    addition,
  );
  assert.equal(next.production, 'INCREMENT-SUM');
  assert.equal(next.bindings['=sum'], 'five');
  assert.equal(next.bindings['=count'], 'zero');
  assert.equal(next.bindings['=newsum'], 'six');
});

test('the right-hand side shows the write until the buffer event applies it', () => {
  const view = selected('INITIALIZE-ADDITION');
  const range = findProductionRange(addition, 'initialize-addition');
  assert.ok(range);
  const rhs = addition.indexOf('sum', range.start + addition.slice(range.start).indexOf('==>'));
  assert.equal(hoverText(addition, rhs, view), 'sum = five');

  const fired = reduceDebugView(
    view,
    {
      time: 0.05,
      module: 'procedural',
      details: 'PRODUCTION-FIRED INITIALIZE-ADDITION',
      done: false,
      buffers: goalBuffers,
    },
    addition,
  );
  assert.equal(fired.fired, true);
  assert.equal(fired.rhsApplied, false);
  assert.equal(hoverText(addition, rhs, fired), 'sum = five');

  const applied = reduceDebugView(
    fired,
    {
      time: 0.05,
      module: 'procedural',
      details: 'MOD-BUFFER-CHUNK GOAL',
      done: false,
      buffers: { goal: { arg1: 'five', arg2: 'two', sum: 'five', count: 'zero' }, retrieval: null },
    },
    addition,
  );
  assert.equal(applied.rhsApplied, true);
  assert.equal(hoverText(addition, rhs, applied), 'sum = five');
});
