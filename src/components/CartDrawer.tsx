import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPrice, itemKey, useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";

export function CartDrawer() {
  const { items, subtotal, drawerOpen, setDrawerOpen, setQuantity, remove } = useCart();
  const { t } = useI18n();

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{t("cart.title")}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">{t("cart.empty")}</p>
            <Button variant="hero" onClick={() => setDrawerOpen(false)} asChild>
              <Link to="/shop">{t("nav.shop")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 py-4">
              {items.map((item) => {
                const key = itemKey(item);
                return (
                  <div key={key} className="flex gap-3 rounded-2xl border bg-card p-3">
                    <img
                      src={item.image ?? ""}
                      alt={item.name}
                      className="h-24 w-20 rounded-xl object-cover"
                    />
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="line-clamp-1 font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[item.size, item.color].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(key)}
                          aria-label={t("cart.remove")}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-full border">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
                            onClick={() => setQuantity(key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
                            onClick={() => setQuantity(key, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="font-medium text-primary">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                <span className="font-display text-xl text-primary">{formatPrice(subtotal)}</span>
              </div>
              <Button variant="hero" size="lg" className="w-full" asChild onClick={() => setDrawerOpen(false)}>
                <Link to="/checkout">{t("common.checkout")}</Link>
              </Button>
              <Button variant="soft" className="w-full" asChild onClick={() => setDrawerOpen(false)}>
                <Link to="/cart">{t("cart.title")}</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
