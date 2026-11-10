import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Order } from '../api/orders';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import type { ReorderResult } from '../cart/reorder';
import { prepareReorder } from '../orders/reorder';
import type { ReorderLookupOutcome } from '../orders/reorder';

type FeedbackLine = { productId: number; title: string; quantity: number; added: boolean; reason: string };
type Feedback = { requestId: string; userId: string; lines: FeedbackLine[] };
type Operation = { requestId: string; userId: string; orderId: string; token: string; controller: AbortController;
  outcomes: ReorderLookupOutcome[]; committing: boolean };
const reasons: Record<string, string> = {
  missing: 'No longer available.', 'out-of-stock': 'Out of stock.',
  'insufficient-stock': 'Not enough current stock for the recorded quantity.',
  'invalid-response': 'Availability could not be verified. Try again.', 'request-failed': 'Availability could not be checked. Try again.',
  timeout: 'Availability check timed out. Try again.', stock: 'Not enough stock for this addition and the quantity already in your bag.',
  'quantity-limit': 'This addition would exceed 100 units of this product.', 'product-limit': 'Your bag already has 20 different products.',
  'unsafe-total': 'This addition exceeds the supported price limit.', 'invalid-cart': 'Review your bag before trying again.',
};
const pricing = 'Current catalog prices apply. Successfully added products already in your bag are repriced for all their units. Reorder only adds to your bag: no order or payment is created, no shipping is arranged and no stock is reserved.';

function combine(operation: Operation, result?: ReorderResult): Feedback {
  return { requestId: operation.requestId, userId: operation.userId, lines: operation.outcomes.map((outcome) => {
    const { productId, title, quantity } = outcome.historical;
    const committed = result?.lines.find((line) => line.productId === productId);
    const added = outcome.status === 'prepared' && committed?.status === 'accepted' && committed.quantity === quantity;
    const reason = outcome.status === 'excluded' ? outcome.reason : committed?.status === 'skipped' ? committed.reason : 'invalid-response';
    return { productId, title, quantity, added, reason: added ? '' : reasons[reason] ?? 'This selection could not be added. Review your bag and try again.' };
  }) };
}

function ReorderFeedback({ feedback }: { feedback: Feedback }) {
  const added = feedback.lines.filter((line) => line.added).length;
  return <div className="my-6 border border-line bg-surface p-5 text-sm leading-6 wrap-anywhere">
    <p role="status" aria-live="polite" aria-atomic="true" className="font-medium">{added === feedback.lines.length && added > 0
      ? 'Items added to cart ✓' : added > 0 ? 'Some items were added to your bag.' : 'No items were added. Review the details below and try again.'}</p>
    <ul className="mt-3 space-y-2" aria-label="Reorder results">{feedback.lines.map((line) => <li key={line.productId}>
      {line.title} — {line.quantity} {line.quantity === 1 ? 'unit' : 'units'}: {line.added ? 'Added.' : `Skipped. ${line.reason}`}
    </li>)}</ul>
    <p className="mt-4 text-xs leading-6 text-muted">{pricing}</p>
  </div>;
}

export function ReorderControl({ order }: { order: Order }) {
  const { user, accessToken } = useAuth();
  const { dispatch, reorderResult } = useCart();
  const navigate = useNavigate();
  const active = useRef<Operation | null>(null);
  const identity = useRef({ userId: user?.id, orderId: order.id, token: accessToken });
  const [pending, setPending] = useState<'lookup' | 'commit' | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useLayoutEffect(() => {
    identity.current = { userId: user?.id, orderId: order.id, token: accessToken };
    return () => { active.current?.controller.abort(); active.current = null; };
  }, [user?.id, order.id, accessToken]);

  function current(operation: Operation) {
    return active.current === operation && !operation.controller.signal.aborted
      && identity.current.userId === operation.userId && identity.current.orderId === operation.orderId && identity.current.token === operation.token;
  }

  useEffect(() => {
    const operation = active.current;
    if (!operation?.committing || !reorderResult || reorderResult.requestId !== operation.requestId || !current(operation)) return;
    const report = combine(operation, reorderResult);
    // Consume before navigating or rendering; StrictMode and later receipts cannot replay this operation.
    active.current = null;
    setPending(null);
    if (report.lines.some((line) => line.added)) navigate('/cart', { state: { reorderFeedback: report } });
    else setFeedback(report);
  }, [reorderResult, navigate]);

  async function reorder() {
    if (active.current || !user || !accessToken) return;
    const operation: Operation = { requestId: crypto.randomUUID(), userId: user.id, orderId: order.id, token: accessToken,
      controller: new AbortController(), outcomes: [], committing: false };
    active.current = operation;
    setPending('lookup'); setError(''); setFeedback(null);
    try {
      const prepared = await prepareReorder(order.items, operation.controller.signal);
      if (!current(operation)) return;
      operation.outcomes = prepared.outcomes;
      if (prepared.status !== 'complete' || prepared.inputs.length === 0) {
        active.current = null; setPending(null);
        if (prepared.status === 'complete') setFeedback(combine(operation));
        else setError(prepared.status === 'timeout' ? 'Availability checks timed out. Your bag has not changed. Please try again.' : 'This order’s items could not be verified. Your bag has not changed. Please try again.');
        return;
      }
      operation.committing = true;
      setPending('commit');
      // No await between this final lifecycle check and the atomic Context dispatch.
      if (!current(operation)) return;
      dispatch({ type: 'reorder', requestId: operation.requestId, lines: prepared.inputs });
    } catch {
      if (!current(operation)) return;
      active.current = null; setPending(null);
      setError('We couldn’t check availability. Your bag has not changed. Please try again.');
    }
  }

  return <div className="mt-8 border-t border-line pt-6">
    <button type="button" className="primary-link min-h-11" disabled={pending !== null} aria-busy={pending !== null} onClick={() => void reorder()}>
      {pending === 'lookup' ? 'Checking availability…' : pending === 'commit' ? 'Updating your bag…' : 'Reorder'}
    </button>
    <p className="mt-3 max-w-2xl text-xs leading-6 text-muted">{pricing}</p>
    {error && <p role="alert" className="mt-4 text-sm leading-6">{error}</p>}
    {feedback && <ReorderFeedback feedback={feedback} />}
  </div>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validatedFeedback(value: unknown, receipt: ReorderResult | null, userId: string | undefined): Feedback | null {
  if (!record(value) || !receipt || value.requestId !== receipt.requestId || value.userId !== userId || !userId
    || !Array.isArray(value.lines) || !value.lines.length || value.lines.length > 20) return null;
  const ids = new Set<number>();
  let accepted = 0;
  for (const line of value.lines) {
    if (!record(line) || typeof line.productId !== 'number' || !Number.isSafeInteger(line.productId) || line.productId < 1 || ids.has(line.productId)
      || typeof line.title !== 'string' || !line.title.trim() || line.title.length > 500
      || typeof line.quantity !== 'number' || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 100
      || typeof line.added !== 'boolean' || typeof line.reason !== 'string' || line.reason.length > 300) return null;
    ids.add(line.productId);
    const actual = receipt.lines.find((item) => item.productId === line.productId);
    if (line.added) {
      if (actual?.status !== 'accepted' || actual.quantity !== line.quantity) return null;
      accepted += 1;
    } else if (actual?.status === 'accepted') return null;
  }
  return accepted > 0 && accepted === receipt.acceptedCount ? value as Feedback : null;
}

export function CartReorderNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reorderResult } = useCart();
  const routeState: unknown = location.state;
  const [feedback, setFeedback] = useState(() => validatedFeedback(record(routeState) ? routeState.reorderFeedback : null, reorderResult, user?.id));
  const consumed = useRef(false);
  useEffect(() => {
    if (consumed.current || !record(routeState) || !('reorderFeedback' in routeState)) return;
    consumed.current = true;
    const { reorderFeedback: removed, ...rest } = routeState;
    void removed;
    void navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true,
      state: { ...rest, reorderNoticeConsumed: feedback?.requestId ?? null } });
  }, [routeState, feedback, location.pathname, location.search, location.hash, navigate]);
  const belongsHere = record(routeState) && (routeState.reorderNoticeConsumed === feedback?.requestId
    || record(routeState.reorderFeedback) && routeState.reorderFeedback.requestId === feedback?.requestId);
  useEffect(() => {
    if (feedback && (!belongsHere || user?.id !== feedback.userId)) setFeedback(null);
  }, [belongsHere, feedback, user?.id]);
  return feedback && user?.id === feedback.userId && belongsHere ? <ReorderFeedback feedback={feedback} /> : null;
}
