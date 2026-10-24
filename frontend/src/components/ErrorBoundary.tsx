import { Component } from 'react';
import type { ReactNode } from 'react';

// A class is required for React's rendering-error lifecycle.
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch() {
    // Keep diagnostics generic: rendered content may contain private user data.
    if (import.meta.env.DEV) console.error('10X Shop caught an unexpected rendering error.');
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <section role="alert" className="page-width min-h-112 py-16 sm:py-24">
      <h1 className="section-title">A brief interruption.</h1>
      <p className="mt-6 max-w-lg text-base leading-7 text-muted">We couldn’t display this page. Reload the application to start again.</p>
      <p className="mt-4 max-w-lg text-sm leading-6 text-muted">Reloading ends your sign-in session. If you were placing an order, sign in and check your order history before trying again.</p>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <button type="button" className="primary-link" onClick={() => window.location.reload()}>Reload application</button>
        <a className="text-link inline-flex items-center text-sm" href="/">Return home</a>
      </div>
    </section>;
  }
}
