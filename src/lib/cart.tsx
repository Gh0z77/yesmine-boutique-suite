import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
};

type Ctx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "yesmine.cart.v1";

export const itemKey = (i: Pick<CartItem, "productId" | "size" | "color">) =>
  `${i.productId}::${i.size ?? ""}::${i.color ?? ""}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const add = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const key = itemKey(item);
      const existing = prev.find((p) => itemKey(p) === key);
      if (existing) {
        return prev.map((p) => (itemKey(p) === key ? { ...p, quantity: p.quantity + quantity } : p));
      }
      return [...prev, { ...item, quantity }];
    });
    setDrawerOpen(true);
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((p) => itemKey(p) !== key)
        : prev.map((p) => (itemKey(p) === key ? { ...p, quantity } : p)),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => itemKey(p) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<Ctx>(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    return { items, count, subtotal, drawerOpen, setDrawerOpen, add, setQuantity, remove, clear };
  }, [items, drawerOpen, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  );
