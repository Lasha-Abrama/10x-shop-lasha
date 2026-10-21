import type { AuthSession } from '../api/auth.ts';

export type AuthState =
  | { status: 'guest'; session: null; notice: string | null }
  | { status: 'authenticating'; session: null; notice: null }
  | { status: 'authenticated'; session: AuthSession; notice: null };
export type AuthAction =
  | { type: 'begin' }
  | { type: 'authenticated'; session: AuthSession }
  | { type: 'guest'; notice?: string };

export const initialAuthState: AuthState = { status: 'guest', session: null, notice: null };
export function authReducer(_state: AuthState, action: AuthAction): AuthState {
  if (action.type === 'begin') return { status: 'authenticating', session: null, notice: null };
  if (action.type === 'authenticated' && action.session.expiresAt > Date.now()) {
    return { status: 'authenticated', session: action.session, notice: null };
  }
  return { status: 'guest', session: null, notice: action.type === 'guest' ? action.notice ?? null : 'Your session has expired. Please sign in again.' };
}

export function canAccessAccount(state: AuthState): boolean {
  return state.status === 'authenticated' && state.session.expiresAt > Date.now();
}
