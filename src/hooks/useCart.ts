// Zustand store for shopping cart

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, CartItemModifier, CheckoutData, Product, Modifier } from '@/types';
import { calculateTax, calculateTotal } from '@/utils/helpers';

interface CartStore {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  taxRate: number;

  addItem: (product: Product, modifiers: Modifier[]) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  editItem: (cartItemId: string, modifiers: Modifier[]) => void;
  clearCart: () => void;
  setTaxRate: (rate: number) => void;
  recalculate: () => void;
}

const createCartId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

const calculateSubtotal = (items: CartItem[]): number => {
  return Math.round(
    items.reduce((sum, item) => {
      const modifierPrice = item.modifiers.reduce((m, mod) => m + mod.price_adjustment, 0);
      return sum + item.unit_price * item.quantity + modifierPrice * item.quantity;
    }, 0) * 100
  ) / 100;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      taxRate: 0,

      addItem: (product, modifiers) => {
        set((state) => {
          const cartItem: CartItem = {
            id: createCartId(),
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.base_price,
            modifiers: modifiers.map((m) => ({
              id: m.id,
              name: m.name,
              price_adjustment: m.price_adjustment,
            })),
          };

          const newItems = [...state.items, cartItem];
          const newSubtotal = calculateSubtotal(newItems);
          const newTax = calculateTax(newSubtotal, state.taxRate);
          const newTotal = calculateTotal(newSubtotal, newTax);

          return {
            items: newItems,
            subtotal: newSubtotal,
            tax: newTax,
            total: newTotal,
          };
        });
      },

      removeItem: (cartItemId) => {
        set((state) => {
          const newItems = state.items.filter((item) => item.id !== cartItemId);
          const newSubtotal = calculateSubtotal(newItems);
          const newTax = calculateTax(newSubtotal, state.taxRate);
          const newTotal = calculateTotal(newSubtotal, newTax);

          return {
            items: newItems,
            subtotal: newSubtotal,
            tax: newTax,
            total: newTotal,
          };
        });
      },

      updateQuantity: (cartItemId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return state;
          }

          const newItems = state.items.map((item) =>
            item.id === cartItemId ? { ...item, quantity } : item
          );

          const newSubtotal = calculateSubtotal(newItems);
          const newTax = calculateTax(newSubtotal, state.taxRate);
          const newTotal = calculateTotal(newSubtotal, newTax);

          return {
            items: newItems,
            subtotal: newSubtotal,
            tax: newTax,
            total: newTotal,
          };
        });
      },

      editItem: (cartItemId, modifiers) => {
        set((state) => {
          const newItems = state.items.map((item) =>
            item.id === cartItemId
              ? {
                  ...item,
                  modifiers: modifiers.map((m) => ({
                    id: m.id,
                    name: m.name,
                    price_adjustment: m.price_adjustment,
                  })),
                }
              : item
          );

          const newSubtotal = calculateSubtotal(newItems);
          const newTax = calculateTax(newSubtotal, state.taxRate);
          const newTotal = calculateTotal(newSubtotal, newTax);

          return {
            items: newItems,
            subtotal: newSubtotal,
            tax: newTax,
            total: newTotal,
          };
        });
      },

      clearCart: () => {
        set({
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0,
        });
      },

      setTaxRate: (rate) => {
        set((state) => {
          const newTax = calculateTax(state.subtotal, rate);
          const newTotal = calculateTotal(state.subtotal, newTax);

          return {
            taxRate: rate,
            tax: newTax,
            total: newTotal,
          };
        });
      },

      recalculate: () => {
        set((state) => {
          const newSubtotal = calculateSubtotal(state.items);
          const newTax = calculateTax(newSubtotal, state.taxRate);
          const newTotal = calculateTotal(newSubtotal, newTax);

          return {
            subtotal: newSubtotal,
            tax: newTax,
            total: newTotal,
          };
        });
      },
    }),
    {
      name: 'cart-store',
    }
  )
);
