import type { OwnedWatch } from '@core/modules/collection/types';
import {
  currentResult,
  initialOpeningState,
  isLocked,
  openingTransition as t,
  toPendingReveal,
  type OpeningEvent,
  type OpeningState,
} from '../machine';

const make = (id: string, watchId = 'w_gmt'): OwnedWatch => ({
  instanceId: id,
  watchId,
  boxId: 'b1',
  origin: 'box',
  acquiredAt: '2026-01-01T00:00:00Z',
  revealed: false,
});
const item = make('i1');
const three = [make('a', 'w_casio'), make('b', 'w_casio'), make('c', 'w_sky')];

function run(events: OpeningEvent[], from: OpeningState = initialOpeningState) {
  return events.reduce(t, from);
}

const resume = (results = [item]): OpeningEvent => ({ type: 'RESUME', boxId: 'b1', results });

describe('opening state machine', () => {
  it('walks the happy path inspect → purchase → ready → opening → revealed', () => {
    const events = [
      { type: 'INSPECT', boxId: 'b1' },
      { type: 'PURCHASE', idempotencyKey: 'k' },
      { type: 'PURCHASE_SUCCEEDED', idempotencyKey: 'k', results: [item] },
      { type: 'LID_GRABBED' },
      { type: 'LID_OPENED' },
    ] as OpeningEvent[];
    const trace: string[] = [];
    events.reduce((s, e) => {
      const next = t(s, e);
      trace.push(next.status);
      return next;
    }, initialOpeningState);
    expect(trace).toEqual(['inspecting', 'purchasing', 'ready', 'opening', 'revealed']);
  });

  it('keeps the idempotency key and count on network error and reuses them on retry', () => {
    const s = run([
      { type: 'INSPECT', boxId: 'b1' },
      { type: 'PURCHASE', idempotencyKey: 'k1', count: 3 },
      { type: 'PURCHASE_FAILED', idempotencyKey: 'k1', reason: 'network' },
    ]);
    expect(s).toEqual({ status: 'error', boxId: 'b1', count: 3, idempotencyKey: 'k1', reason: 'network' });
    expect(t(s, { type: 'RETRY' })).toEqual({ status: 'purchasing', boxId: 'b1', count: 3, idempotencyKey: 'k1' });
  });

  it('does not allow retrying a funds error; it goes back to inspecting', () => {
    const s = run([
      { type: 'INSPECT', boxId: 'b1' },
      { type: 'PURCHASE', idempotencyKey: 'k1' },
      { type: 'PURCHASE_FAILED', idempotencyKey: 'k1', reason: 'funds' },
    ]);
    expect(t(s, { type: 'RETRY' })).toBe(s);
    expect(t(s, { type: 'DISMISS_ERROR' })).toEqual({ status: 'inspecting', boxId: 'b1' });
  });

  it('ignores stale responses for another key, and empty results', () => {
    const s = run([
      { type: 'INSPECT', boxId: 'b1' },
      { type: 'PURCHASE', idempotencyKey: 'k2' },
    ]);
    expect(t(s, { type: 'PURCHASE_SUCCEEDED', idempotencyKey: 'old', results: [item] })).toBe(s);
    expect(t(s, { type: 'PURCHASE_SUCCEEDED', idempotencyKey: 'k2', results: [] })).toBe(s);
  });

  it('ignores double purchase taps', () => {
    const s = run([
      { type: 'INSPECT', boxId: 'b1' },
      { type: 'PURCHASE', idempotencyKey: 'k1' },
    ]);
    expect(t(s, { type: 'PURCHASE', idempotencyKey: 'k2' })).toBe(s);
  });

  it('only lets the lid be grabbed once purchased', () => {
    const inspecting = run([{ type: 'INSPECT', boxId: 'b1' }]);
    expect(t(inspecting, { type: 'LID_GRABBED' })).toBe(inspecting);
  });

  it('releasing the lid below the threshold returns to ready', () => {
    const s = run([resume(), { type: 'LID_GRABBED' }, { type: 'LID_RELEASED' }]);
    expect(s.status).toBe('ready');
  });

  it('blocks leaving while purchasing or opening', () => {
    const purchasing = run([
      { type: 'INSPECT', boxId: 'b1' },
      { type: 'PURCHASE', idempotencyKey: 'k' },
    ]);
    const opening = run([resume(), { type: 'LID_GRABBED' }]);
    for (const s of [purchasing, opening]) {
      expect(isLocked(s)).toBe(true);
      expect(t(s, { type: 'EXIT' })).toBe(s);
      expect(t(s, { type: 'INSPECT', boxId: 'other' })).toBe(s);
    }
    const ready = run([resume()]);
    expect(isLocked(ready)).toBe(false);
    expect(t(ready, { type: 'EXIT' })).toEqual(initialOpeningState);
  });

  it('persists a pending reveal only while pulls are unseen', () => {
    const ready = run([resume()]);
    expect(toPendingReveal(ready)).toEqual({ boxId: 'b1', results: [item] });
    expect(toPendingReveal(t(ready, { type: 'LID_GRABBED' }))).toEqual({ boxId: 'b1', results: [item] });
    expect(toPendingReveal(t(ready, { type: 'LID_OPENED' }))).toBeNull();
    expect(toPendingReveal(run([{ type: 'INSPECT', boxId: 'b1' }]))).toBeNull();
  });

  it('resume puts paid items straight into ready, but never with nothing to show', () => {
    expect(run([resume()])).toEqual({ status: 'ready', boxId: 'b1', results: [item] });
    expect(run([resume([])])).toBe(initialOpeningState);
  });
});

describe('multi-open', () => {
  const opened = run([resume(three), { type: 'LID_OPENED' }]);

  it('reveals pulls one at a time, then shows a summary', () => {
    expect(opened).toMatchObject({ status: 'revealed', index: 0 });
    expect(currentResult(opened)?.instanceId).toBe('a');

    const second = t(opened, { type: 'REVEAL_NEXT' });
    expect(second).toMatchObject({ status: 'revealed', index: 1 });
    const third = t(second, { type: 'REVEAL_NEXT' });
    expect(currentResult(third)?.instanceId).toBe('c');

    const summary = t(third, { type: 'REVEAL_NEXT' });
    expect(summary).toEqual({ status: 'summary', boxId: 'b1', results: three });
    expect(t(summary, { type: 'REVEAL_NEXT' })).toBe(summary);
  });

  it('a single open has no next step', () => {
    const single = run([resume(), { type: 'LID_OPENED' }]);
    expect(t(single, { type: 'REVEAL_NEXT' })).toBe(single);
  });

  it('only the pulls after the one on screen stay pending', () => {
    expect(toPendingReveal(opened)).toEqual({ boxId: 'b1', results: three.slice(1) });
    const last = run([{ type: 'REVEAL_NEXT' }, { type: 'REVEAL_NEXT' }], opened);
    expect(toPendingReveal(last)).toBeNull();
  });

  it('can leave or open again from the summary', () => {
    const summary = run([{ type: 'REVEAL_NEXT' }, { type: 'REVEAL_NEXT' }, { type: 'REVEAL_NEXT' }], opened);
    expect(isLocked(summary)).toBe(false);
    expect(t(summary, { type: 'INSPECT', boxId: 'b1' })).toEqual({ status: 'inspecting', boxId: 'b1' });
  });
});
