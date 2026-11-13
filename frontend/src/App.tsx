import { lazy } from 'react';
import { Link, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';

// One chunk per page module; login/register and order list/details share theirs.
const ProductsPage = lazy(() => import('./pages/ProductsPage').then((page) => ({ default: page.ProductsPage })));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage').then((page) => ({ default: page.ProductDetailsPage })));
const CartPage = lazy(() => import('./pages/CartPage').then((page) => ({ default: page.CartPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((page) => ({ default: page.AuthPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((page) => ({ default: page.AccountPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((page) => ({ default: page.CheckoutPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((page) => ({ default: page.OrdersPage })));

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailsPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<AuthPage key="login" mode="login" />} />
        <Route path="register" element={<AuthPage key="register" mode="register" />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="profile" element={<AccountPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrdersPage />} />
        <Route path="*" element={
          <section className="page-width min-h-112 py-16 sm:py-24">
            <h1 className="section-title">404 — Page not found</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted">This page may have moved, or the address may be incorrect.</p>
            <Link className="primary-link mt-8" to="/">Return to homepage</Link>
          </section>
        } />
      </Route>
    </Routes>
  );
}
