import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { authPath } from '../auth/returnTo';

export function SignInPrompt({ returnTo }: { returnTo: string }) {
  const { status } = useAuth();
  return <section className="page-width min-h-112 py-16 sm:py-24">
    <h1 className="section-title">{status === 'authenticating' ? 'A moment, please.' : 'Sign in to continue.'}</h1>
    {status === 'authenticating' ? <p role="status" className="mt-6 text-muted">Confirming your account…</p> : <>
      <p className="mt-6 max-w-lg text-base leading-7 text-muted">{returnTo === '/checkout' ? 'Sign in before placing your order. Your shopping bag stays with you.' : 'Sign in to see your orders. If you refreshed the page, please sign in again.'}</p>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Link className="primary-link" to={authPath('login', returnTo)}>Login</Link>
        <Link className="text-link inline-flex items-center text-sm" to={authPath('register', returnTo)}>Create account</Link>
      </div>
      <Link className="text-link mt-6 inline-flex items-center text-sm" to="/cart">Back to your bag</Link>
    </>}
  </section>;
}
