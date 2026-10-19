import { createContext, useContext, useEffect, useReducer, useState } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { cartReducer } from './cart';
import type { CartAction, CartState } from './cart';
import { loadCart, saveCart } from './storage';

const CartContext = createContext<{
  state: CartState;
  dispatch: Dispatch<CartAction>;
  persistenceError: boolean;
} | undefined>(undefined);

function initialCart(): CartState {
  try { return loadCart(window.localStorage); }
  catch { return { items: [] }; }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, initialCart);
  const [persistenceError, setPersistenceError] = useState(false);

  useEffect(() => {
    try { setPersistenceError(!saveCart(window.localStorage, state)); }
    catch { setPersistenceError(true); }
  }, [state]);

  return <CartContext.Provider value={{ state, dispatch, persistenceError }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
}
