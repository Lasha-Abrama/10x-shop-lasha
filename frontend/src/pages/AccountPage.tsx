import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { authPath } from '../auth/returnTo';

export function AccountPage() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function signOut() {
    setSigningOut(true);
    setLogoutError('');
    try {
      if (await logout()) void navigate('/products');
    } catch {
      setLogoutError('We couldn’t sign you out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }
  if (!user) return <section className="page-width min-h-112 py-16 sm:py-24">
    <h1 className="section-title">{status === 'authenticating' ? 'A moment, please.' : 'Your account awaits.'}</h1>
    {status === 'authenticating' ? <p role="status" className="mt-6 text-muted">Confirming your account…</p> : <>
      <p className="mt-6 max-w-md text-base leading-7 text-muted">Login to see your account details.</p>
      <div className="mt-8 flex flex-wrap items-center gap-6"><Link className="primary-link" to={authPath('login', pathname)}>Login</Link><Link className="text-link touch-target items-center text-sm" to={authPath('register', pathname)}>Create account</Link></div>
    </>}
  </section>;

  return <section className="page-width grid gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:gap-24">
    <div><h1 className="section-title">Good to see you.</h1><p className="mt-6 max-w-md text-base leading-7 text-muted">Your 10X Shop account, at a glance.</p><Link to="/products" className="text-link touch-target mt-6 items-center text-sm">Explore the collection</Link></div>
    <div className="min-w-0"><h2 className="font-display text-3xl">Profile details</h2>
      <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
        <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]"><dt className="text-muted">Email address</dt><dd className="wrap-anywhere">{user.email}</dd></div>
        <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]"><dt className="text-muted">Member since</dt><dd>{new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(user.createdAt))}</dd></div>
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-6"><Link to="/orders" className="primary-link">View your orders</Link><button type="button" disabled={signingOut} onClick={signOut} className="touch-target rounded-editorial border border-red-700 px-4 text-sm text-red-800 hover:bg-red-50 disabled:opacity-60">{signingOut ? 'Signing out…' : 'Logout'}</button></div>
      {logoutError && <p role="alert" className="mt-4 text-sm">{logoutError}</p>}
    </div>
  </section>;
}
