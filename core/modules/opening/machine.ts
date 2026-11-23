import type { OwnedWatch } from '@core/modules/collection/types';

export type PurchaseFailureReason = 'funds' | 'network';

/**
 * `results` are in reveal order (the server sends the best pull last). A
 * single open is just `results.length === 1`.
 */
export type OpeningState =
  | { status: 'idle' }
  | { status: 'inspecting'; boxId: string }
  | { status: 'purchasing'; boxId: string; count: number; idempotencyKey: string }
  /** Bought, the lid can be opened. */
  | { status: 'ready'; boxId: string; results: OwnedWatch[] }
  /** The user is physically lifting the lid. */
  | { status: 'opening'; boxId: string; results: OwnedWatch[] }
  /** Showing `results[index]`. */
  | { status: 'revealed'; boxId: string; results: OwnedWatch[]; index: number }
  /** Multi-open only: every pull has been shown, recap with actions. */
  | { status: 'summary'; boxId: string; results: OwnedWatch[] }
  | {
      status: 'error';
      boxId: string;
      count: number;
      idempotencyKey: string;
      reason: PurchaseFailureReason;
    };

export type OpeningStatus = OpeningState['status'];

export type OpeningEvent =
  | { type: 'INSPECT'; boxId: string }
  /** Resume already purchased but unrevealed items (app restart, collection). */
  | { type: 'RESUME'; boxId: string; results: OwnedWatch[] }
  | { type: 'PURCHASE'; idempotencyKey: string; count?: number }
  | { type: 'PURCHASE_SUCCEEDED'; idempotencyKey: string; results: OwnedWatch[] }
  | { type: 'PURCHASE_FAILED'; idempotencyKey: string; reason: PurchaseFailureReason }
  /** Network failure → retry with the SAME key so the server can dedupe. */
  | { type: 'RETRY' }
  /** Funds failure → back to inspecting; next attempt gets a new key. */
  | { type: 'DISMISS_ERROR' }
  | { type: 'LID_GRABBED' }
  | { type: 'LID_RELEASED' }
  | { type: 'LID_OPENED' }
  /** Multi-open: show the next pull, or the summary after the last one. */
  | { type: 'REVEAL_NEXT' }
  | { type: 'EXIT' };

export const initialOpeningState: OpeningState = { status: 'idle' };

/**
 * Pure transition function. Unknown or out-of-order events return the same
 * state object, so callers can cheaply detect "nothing happened".
 */
export function openingTransition(state: OpeningState, event: OpeningEvent): OpeningState {
  switch (event.type) {
    case 'INSPECT':
      return canLeave(state) ? { status: 'inspecting', boxId: event.boxId } : state;

    case 'RESUME':
      if (!canLeave(state) || event.results.length === 0) {
        return state;
      }
      return { status: 'ready', boxId: event.boxId, results: event.results };

    case 'PURCHASE':
      if (state.status !== 'inspecting') {
        return state;
      }
      return {
        status: 'purchasing',
        boxId: state.boxId,
        count: event.count ?? 1,
        idempotencyKey: event.idempotencyKey,
      };

    case 'PURCHASE_SUCCEEDED':
      if (
        state.status !== 'purchasing' ||
        state.idempotencyKey !== event.idempotencyKey ||
        event.results.length === 0
      ) {
        return state;
      }
      return { status: 'ready', boxId: state.boxId, results: event.results };

    case 'PURCHASE_FAILED':
      if (state.status !== 'purchasing' || state.idempotencyKey !== event.idempotencyKey) {
        return state;
      }
      return {
        status: 'error',
        boxId: state.boxId,
        count: state.count,
        idempotencyKey: state.idempotencyKey,
        reason: event.reason,
      };

    case 'RETRY':
      if (state.status !== 'error' || state.reason !== 'network') {
        return state;
      }
      return {
        status: 'purchasing',
        boxId: state.boxId,
        count: state.count,
        idempotencyKey: state.idempotencyKey,
      };

    case 'DISMISS_ERROR':
      if (state.status !== 'error') {
        return state;
      }
      return { status: 'inspecting', boxId: state.boxId };

    case 'LID_GRABBED':
      if (state.status !== 'ready') {
        return state;
      }
      return { status: 'opening', boxId: state.boxId, results: state.results };

    case 'LID_RELEASED':
      if (state.status !== 'opening') {
        return state;
      }
      return { status: 'ready', boxId: state.boxId, results: state.results };

    case 'LID_OPENED':
      if (state.status !== 'opening' && state.status !== 'ready') {
        return state;
      }
      return { status: 'revealed', boxId: state.boxId, results: state.results, index: 0 };

    case 'REVEAL_NEXT':
      if (state.status !== 'revealed' || state.results.length < 2) {
        return state;
      }
      if (state.index < state.results.length - 1) {
        return { ...state, index: state.index + 1 };
      }
      return { status: 'summary', boxId: state.boxId, results: state.results };

    case 'EXIT':
      return canLeave(state) ? initialOpeningState : state;
  }
}

/**
 * While money is in flight or the lid is in the user's hands, the screen must
 * not be dismissed. `ready` may be left: the items are already persisted as
 * unrevealed and can be resumed from the collection.
 */
export function isLocked(state: OpeningState): boolean {
  return state.status === 'purchasing' || state.status === 'opening';
}

function canLeave(state: OpeningState): boolean {
  return !isLocked(state);
}

/** The pull currently on screen, if any. */
export function currentResult(state: OpeningState): OwnedWatch | undefined {
  if (state.status === 'revealed') {
    return state.results[state.index];
  }
  if (state.status === 'ready' || state.status === 'opening') {
    return state.results[0];
  }
  return undefined;
}

export type PendingReveal = { boxId: string; results: OwnedWatch[] };

/**
 * Paid-for pulls the user has not seen yet; must survive an app kill. Mid
 * multi-reveal, only the pulls after the current one are still pending.
 */
export function toPendingReveal(state: OpeningState): PendingReveal | null {
  if (state.status === 'ready' || state.status === 'opening') {
    return { boxId: state.boxId, results: state.results };
  }
  if (state.status === 'revealed' && state.index < state.results.length - 1) {
    return { boxId: state.boxId, results: state.results.slice(state.index + 1) };
  }
  return null;
}
