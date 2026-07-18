import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestScheduler } from '../RequestScheduler.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('never runs more than three jobs concurrently', async () => {
  const scheduler = new RequestScheduler(3);
  const gates = Array.from({ length: 6 }, deferred);
  let active = 0;
  let peak = 0;
  const jobs = gates.map((gate) => scheduler.schedule(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await gate.promise;
    active -= 1;
  }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(active, 3);
  gates.forEach((gate) => gate.resolve());
  await Promise.all(jobs);
  assert.equal(peak, 3);
});

test('critical work passes queued background work', async () => {
  const scheduler = new RequestScheduler(1);
  const gate = deferred();
  const order = [];
  const first = scheduler.schedule(() => gate.promise, { priority: 'visible' });
  const background = scheduler.schedule(() => { order.push('background'); }, { priority: 'background' });
  const critical = scheduler.schedule(() => { order.push('critical'); }, { priority: 'critical' });
  gate.resolve();
  await Promise.all([first, background, critical]);
  assert.deepEqual(order, ['critical', 'background']);
});

test('deduplicates jobs with the same key', async () => {
  const scheduler = new RequestScheduler(3);
  let calls = 0;
  const task = async () => {
    calls += 1;
    return 'shared';
  };
  const values = await Promise.all([
    scheduler.schedule(task, { key: 'GET:/api/test' }),
    scheduler.schedule(task, { key: 'GET:/api/test' }),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(values, ['shared', 'shared']);
});
