import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { CartProvider } from './cart/CartContext';
import { AuthProvider } from './auth/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><BrowserRouter>
      <AuthProvider><CartProvider><App /></CartProvider></AuthProvider>
    </BrowserRouter></ErrorBoundary>
  </StrictMode>,
);
