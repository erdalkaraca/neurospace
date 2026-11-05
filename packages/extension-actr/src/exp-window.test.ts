import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  actrKeyFromEvent,
  beginHumanTrial,
  expWindowsFor,
  isProcessEvents,
  noteHumanDismiss,
  queueHumanKey,
  reduceExpWindows,
  showExpWindowMessages,
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

test('a key during the wait is delivered to that process', async () => {
  beginHumanTrial('keys');
  const pending = waitForHumanKeys('keys', 200);
  queueHumanKey('keys', 'b');
  assert.deepEqual(await pending, ['b']);
});

test('closing one window does not answer the other process', async () => {
  beginHumanTrial('close-a');
  beginHumanTrial('close-b');
  noteHumanDismiss('close-a');
  const other = waitForHumanKeys('close-b', 20);
  assert.deepEqual(await waitForHumanKeys('close-a', 20), ['escape']);
  assert.deepEqual(await other, []);
});

test('one process cannot draw the other process window', () => {
  showExpWindowMessages('p1', [
    ['open', 'Letter recognition', 0, 0, 300, 300],
    ['text', 'Letter recognition', 't', 10, 10, 'A', 'black', 12],
  ]);
  showExpWindowMessages('p2', [['open', 'Letter difference', 0, 0, 300, 300]]);
  assert.equal(expWindowsFor('p1')?.has('Letter difference'), false);
  assert.equal(expWindowsFor('p2')?.has('Letter recognition'), false);
  assert.equal(expWindowsFor('p1')?.get('Letter recognition')?.items.length, 1);
  assert.equal(expWindowsFor('p2')?.get('Letter difference')?.items.length, 0);
});
