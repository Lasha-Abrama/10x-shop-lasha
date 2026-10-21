import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';

export function AccountPage() {
  const { user, status, logout } = useAuth();
  if (!user) return <section className="page-width min-h-112 py-16 sm:py-24">
    <h1 className="section-title">{status === 'authenticating' ? 'A moment, please.' : 'Your account awaits.'}</h1>
    {status === 'authenticating' ? <p role="status" className="mt-6 text-muted">Confirming your account…</p> : <>
      <p className="mt-6 max-w-md text-base leading-7 text-muted">Login to see your account details. If you refreshed the page, please sign in again.</p>
      <div className="mt-8 flex flex-wrap items-center gap-6"><Link className="primary-link" to="/login">Login</Link><Link className="text-link inline-flex items-center text-sm" to="/register">Create account</Link></div>
    </>}
  </section>;

  return <section className="page-width grid gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:gap-24">
    <div><h1 className="section-title">Good to see you.</h1><p className="mt-6 max-w-md text-base leading-7 text-muted">Your 10X Shop account, at a glance. Sign-in ends when you refresh or close this page.</p><Link to="/products" className="text-link mt-6 inline-flex items-center text-sm">Explore the collection</Link></div>
    <div className="min-w-0"><h2 className="font-display text-3xl">Account details</h2>
      <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
        <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]"><dt className="text-muted">Email address</dt><dd className="wrap-anywhere">{user.email}</dd></div>
        <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]"><dt className="text-muted">Account role</dt><dd>{user.role === 'ADMIN' ? 'Admin' : 'User'}</dd></div>
        <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]"><dt className="text-muted">Member since</dt><dd>{new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(user.createdAt))}</dd></div>
      </dl>
      <button type="button" onClick={logout} className="text-link mt-6 text-sm">Logout</button>
    </div>
  </section>;
}
