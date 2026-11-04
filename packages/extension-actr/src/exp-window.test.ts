import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  actrKeyFromEvent,
  isProcessEvents,
  noteHumanDismiss,
  queueHumanKey,
  reduceExpWindows,
  waitForHumanKeys,
  type ExpWindowState,
} from './exp-window.ts';

test('visible window messages build and clear a display', () => {
  const windows = new Map<string, ExpWindowState>();
  reduceExpWindows(windows, [
    ['check'],
    ['open', 'Letter difference', 300, 200, 300, 300],
    ['text', 'Letter difference', 'text1', 125, 75, 'B', 'black', 12],
    ['line', 'Letter difference', 'line1', 10, 10, 40, 10, 'green'],
    ['attention', 'Letter difference', 'unit2', 310, 210, 'red'],
  ]);

  const state = windows.get('Letter difference');
  assert.ok(state);
  assert.equal(state.width, 300);
  assert.equal(state.items.length, 2);
  assert.deepEqual(state.attention, { x: 10, y: 10, color: 'red' });

  reduceExpWindows(windows, [
    ['remove', 'Letter difference', 'text1'],
    ['clearattention', 'Letter difference', 'unit2'],
    ['close', 'Letter difference'],
  ]);
  assert.equal(windows.has('Letter difference'), false);
});

test('response keys use ACT-R names', () => {
  const plain = { metaKey: false, ctrlKey: false, altKey: false };
  assert.equal(actrKeyFromEvent({ key: 'B', ...plain }), 'b');
  assert.equal(actrKeyFromEvent({ key: ' ', ...plain }), 'space');
  assert.equal(actrKeyFromEvent({ key: 'Enter', ...plain }), 'return');
  assert.equal(actrKeyFromEvent({ key: 'Shift', ...plain }), null);
  assert.equal(actrKeyFromEvent({ key: 'b', ...plain, ctrlKey: true }), null);
  assert.equal(isProcessEvents('evaluate', ['process-events', false]), true);
  assert.equal(isProcessEvents('evaluate', ['run', 10]), false);
});

test('a key during the wait is delivered from anywhere', async () => {
  const windows = new Map<string, ExpWindowState>();
  reduceExpWindows(windows, [['open', 'Letter difference', 0, 0, 300, 300]]);
  const pending = waitForHumanKeys(200);
  queueHumanKey('b');
  assert.deepEqual(await pending, ['b']);
});

test('closing the window ends the next wait', async () => {
  const windows = new Map<string, ExpWindowState>();
  reduceExpWindows(windows, [['open', 'Letter difference', 0, 0, 300, 300]]);
  noteHumanDismiss();
  assert.deepEqual(await waitForHumanKeys(20), ['escape']);
});
