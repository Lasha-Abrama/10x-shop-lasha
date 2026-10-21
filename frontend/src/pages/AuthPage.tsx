import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { AuthApiError, validateCredentials } from '../api/auth';
import type { Credentials } from '../api/auth';
import { authPath, safeReturnTo } from '../auth/returnTo';

const inputClass = 'mt-2 min-h-13 w-full rounded-editorial border border-muted bg-paper px-4 py-3 text-base caret-accent hover:border-ink disabled:opacity-60';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const returnTo = safeReturnTo(search.get('returnTo'));
  const [credentials, setCredentials] = useState<Credentials>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Credentials, string>>>({});
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const failureBox = useRef<HTMLParagraphElement>(null);
  const isLogin = mode === 'login';

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (failure) failureBox.current?.focus(); }, [failure]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const validation = validateCredentials(credentials);
    setErrors(validation);
    setFailure('');
    if (validation.email || validation.password) {
      (validation.email ? emailInput : passwordInput).current?.focus();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      if (isLogin) {
        await login(credentials, controller.signal);
        if (!controller.signal.aborted) navigate(returnTo, { replace: true });
      } else {
        const message = await register(credentials, controller.signal);
        if (!controller.signal.aborted) setSuccess(message);
      }
      if (!controller.signal.aborted) setCredentials({ email: '', password: '' });
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(error instanceof AuthApiError ? error.message : 'We couldn’t complete your request. Please try again.');
    } finally {
      if (!controller.signal.aborted) setPending(false);
      if (request.current === controller) request.current = null;
    }
  }

  if (user) return <Navigate to={returnTo} replace />;

  return (
    <section className="page-width grid gap-12 py-12 sm:py-16 lg:min-h-160 lg:grid-cols-[1fr_26rem] lg:gap-24 lg:py-24 xl:grid-cols-[1fr_30rem]">
      <div className="max-w-xl lg:pt-4">
        <h1 className="font-display text-[clamp(2.75rem,5vw,4.5rem)] leading-[1.05] tracking-[-0.02em]">{isLogin ? 'A familiar place.' : 'Make yourself at home.'}</h1>
        <p className="mt-6 max-w-md text-base leading-7 text-muted">{isLogin ? 'Welcome back to 10X Shop. Sign in to view your account, then take another look around.' : 'Create a 10X Shop account. A few simple details, and you can return to the collection.'}</p>
        <p className="mt-8 max-w-sm border-t border-line pt-5 text-sm leading-6 text-muted">Sign-in lasts for this visit. Refreshing or closing the page signs you out; your shopping bag is saved separately.</p>
        <Link to="/products" className="text-link mt-6 inline-flex items-center text-sm">Back to the collection</Link>
      </div>
      <div className="min-w-0 border-t border-line pt-8 lg:border-t-0 lg:pt-0">
        {success ? <div role="status" className="bg-surface p-6 sm:p-8">
          <h2 className="font-display text-3xl">Request received.</h2>
          <p className="mt-5 text-sm leading-7 text-muted">{success}</p>
          <Link to={authPath('login', returnTo)} className="primary-link mt-7">Continue to login</Link>
        </div> : <>
          <h2 className="font-display text-3xl">{isLogin ? 'Login' : 'Create account'}</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{isLogin ? 'New here? ' : 'Already have an account? '}<Link className="nav-link underline" to={authPath(isLogin ? 'register' : 'login', returnTo)}>{isLogin ? 'Create an account' : 'Login'}</Link></p>
          <form noValidate onSubmit={submit} aria-busy={pending} className="mt-8">
            <fieldset disabled={pending} className="space-y-6">
              <legend className="sr-only">{isLogin ? 'Login credentials' : 'Registration details'}</legend>
              <div>
                <label htmlFor="auth-email" className="text-sm font-medium">Email address</label>
                <input ref={emailInput} id="auth-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} className={inputClass} />
                {errors.email && <p id="email-error" className="mt-2 text-sm leading-6 text-ink">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="auth-password" className="text-sm font-medium">Password</label>
                <input ref={passwordInput} id="auth-password" name="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} required value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} aria-invalid={Boolean(errors.password)} aria-describedby="password-help password-error" className={inputClass} />
                <p id="password-help" className="mt-3 text-xs leading-5 text-muted">15–128 characters. Spaces are kept as entered.</p>
                <p id="password-error" className="mt-2 text-sm leading-6 text-ink">{errors.password}</p>
              </div>
              <button type="submit" disabled={pending} className="primary-link min-h-13 w-full disabled:cursor-wait disabled:opacity-60">{pending ? isLogin ? 'Signing in…' : 'Sending request…' : isLogin ? 'Login' : 'Create account'}<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></button>
            </fieldset>
            {failure && <p ref={failureBox} role="alert" tabIndex={-1} className="mt-6 border border-line bg-surface p-4 text-sm leading-6">{failure}</p>}
            <p role="status" className="sr-only">{pending ? isLogin ? 'Checking your sign-in details.' : 'Submitting registration request.' : ''}</p>
          </form>
        </>}
      </div>
    </section>
  );
}
