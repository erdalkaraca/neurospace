import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mailboxResult } from './mailbox-client.ts';
import {
  ACTR_REQUEST,
  ACTR_RESPONSE,
  actrWorkerBridgeSource,
  answerActrRequest,
  isActrRequest,
  loadActRModelPath,
  actrWorkspacePath,
  type ActrRequestMessage,
} from './actr-dispatcher.ts';

test('mailboxResult returns the result list', () => {
  assert.deepEqual(mailboxResult({ result: [1.5, 4], error: null, id: 1 }), [1.5, 4]);
  assert.deepEqual(mailboxResult({ result: null, error: null, id: 1 }), []);
});

test('mailboxResult throws the remote error message', () => {
  assert.throws(
    () => mailboxResult({ result: null, error: { message: 'unsupported method "add"' }, id: 2 }),
    /unsupported method/,
  );
});

test('load_act_r_model is recognized and mapped onto a tutorial file', () => {
  const request: ActrRequestMessage = {
    id: 'actr-load',
    type: ACTR_REQUEST,
    payload: {
      method: 'evaluate',
      params: ['load-act-r-model', false, 'ACT-R:tutorial;unit5;fan-model.lisp'],
    },
  };
  assert.equal(loadActRModelPath(request), 'ACT-R:tutorial;unit5;fan-model.lisp');
  assert.equal(
    actrWorkspacePath(loadActRModelPath(request)!),
    'ACT-R/tutorial/unit5/fan-model.lisp',
  );
  assert.equal(
    actrWorkspacePath('ACT-R:tutorial;unit2;unit2-assignment-model.lisp'),
    'ACT-R/tutorial/unit2/unit2-assignment-model.lisp',
  );
  assert.equal(
    actrWorkspacePath('act-r:tutorial;unit2;unit2-assignment-model.lisp'),
    'act-r/tutorial/unit2/unit2-assignment-model.lisp',
  );
  assert.equal(
    loadActRModelPath({
      id: 'actr-run',
      type: ACTR_REQUEST,
      payload: { method: 'evaluate', params: ['run', false, 10] },
    }),
    undefined,
  );
});

test('answerActrRequest forwards method and params to the service', async () => {
  const seen: Array<{ method: string; params: unknown[] }> = [];
  const request: ActrRequestMessage = {
    id: 'actr-1',
    type: ACTR_REQUEST,
    payload: {
      method: 'evaluate',
      params: ['open-exp-window', false, 'Sentence Experiment', [['visible', false]]],
    },
  };
  const response = await answerActrRequest(
    {
      async call(method, params = []) {
        seen.push({ method, params });
        return ['win1'];
      },
    },
    request,
  );
  assert.deepEqual(seen, [
    {
      method: 'evaluate',
      params: ['open-exp-window', false, 'Sentence Experiment', [['visible', false]]],
    },
  ]);
  assert.deepEqual(response, {
    id: 'actr-1',
    type: ACTR_RESPONSE,
    payload: { result: ['win1'] },
  });
});

test('answerActrRequest forwards command callbacks', async () => {
  const response = await answerActrRequest(
    {
      async call() {
        return [1.5, 4];
      },
      takeCallbacks() {
        return [['unit2-key-press', ['unit2', 'b']]];
      },
    },
    { id: 'actr-cb', type: ACTR_REQUEST, payload: { method: 'evaluate', params: ['run', false, 10, true] } },
  );
  assert.deepEqual(response.payload.result, [1.5, 4]);
  assert.deepEqual(response.payload.callbacks, [['unit2-key-press', ['unit2', 'b']]]);
});

test('answerActrRequest reports service failures to Python', async () => {
  const response = await answerActrRequest(
    {
      async call() {
        throw new Error('Could not start ACT-R connection.');
      },
    },
    { id: 'actr-2', type: ACTR_REQUEST, payload: { method: 'evaluate', params: ['reset', false] } },
  );
  assert.equal(response.payload.error, 'Could not start ACT-R connection.');
});

test('worker bridge speaks the same message types', () => {
  const source = actrWorkerBridgeSource();
  assert.match(source, new RegExp(ACTR_REQUEST));
  assert.match(source, new RegExp(ACTR_RESPONSE));
  assert.equal(isActrRequest({ id: 'actr-3', type: ACTR_REQUEST, payload: { method: 'check' } }), true);
  assert.equal(isActrRequest({ id: 1, type: ACTR_REQUEST }), false);
});
