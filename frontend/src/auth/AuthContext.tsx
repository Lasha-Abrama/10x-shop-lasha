import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';
import { authenticate, registerAccount } from '../api/auth';
import type { AuthUser, Credentials } from '../api/auth';
import { authReducer, canAccessAccount, initialAuthState } from './state';
import type { AuthState } from './state';

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthState['status'];
  notice: string | null;
  accessToken: string | null;
  invalidateSession: () => void;
  login: (credentials: Credentials, signal: AbortSignal) => Promise<void>;
  register: (credentials: Credentials, signal: AbortSignal) => Promise<string>;
  logout: () => void;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    function expireIfNeeded() {
      if (state.status === 'authenticated' && Date.now() >= state.session.expiresAt) {
        dispatch({ type: 'guest', notice: 'Your session has expired. Please sign in again.' });
      }
    }
    const timer = window.setTimeout(expireIfNeeded, Math.max(0, state.session.expiresAt - Date.now()));
    window.addEventListener('focus', expireIfNeeded);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', expireIfNeeded); };
  }, [state]);

  async function login(credentials: Credentials, callerSignal: AbortSignal): Promise<void> {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const signal = AbortSignal.any([controller.signal, callerSignal]);
    dispatch({ type: 'begin' });
    try {
      const session = await authenticate(credentials, signal);
      if (signal.aborted || active.current !== controller) throw new DOMException('Request cancelled', 'AbortError');
      dispatch({ type: 'authenticated', session });
    } catch (error: unknown) {
      if (active.current === controller) dispatch({ type: 'guest' });
      throw error;
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  const endSession = useCallback((notice: string) => {
    active.current?.abort();
    active.current = null;
    dispatch({ type: 'guest', notice });
  }, []);
  const logout = useCallback(() => endSession('You have signed out.'), [endSession]);
  const invalidateSession = useCallback(() => endSession('Your session has ended. Please sign in again.'), [endSession]);

  return <AuthContext.Provider value={{
    user: canAccessAccount(state) ? state.session?.user ?? null : null,
    status: state.status === 'authenticated' && !canAccessAccount(state) ? 'guest' : state.status, notice: state.notice,
    accessToken: canAccessAccount(state) ? state.session?.token ?? null : null,
    login, logout, invalidateSession, register: registerAccount,
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
