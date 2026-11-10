import { createContext, useContext, useEffect, useReducer, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { CartState } from './cart';
import { cartStoreReducer } from './reorder';
import type { CartStoreAction, CartStoreState, ReorderResult } from './reorder';
import { loadCart, saveCart } from './storage';

const CartContext = createContext<{
  state: CartState;
  dispatch: Dispatch<CartStoreAction>;
  reorderResult: ReorderResult | null;
  persistenceError: boolean;
} | undefined>(undefined);

function initialCart(): CartStoreState {
  let cart: CartState;
  try { cart = loadCart(window.localStorage); }
  catch { cart = { items: [] }; }
  return { cart, reorderResult: null };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(cartStoreReducer, undefined, initialCart);
  const state = store.cart;
  const [persistenceError, setPersistenceError] = useState(false);

  useEffect(() => {
    try { setPersistenceError(!saveCart(window.localStorage, state)); }
    catch { setPersistenceError(true); }
  }, [state]);

  return <CartContext.Provider value={{ state, dispatch, reorderResult: store.reorderResult, persistenceError }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
