import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { formatPrice, itemKey, useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Yesmine" },
      { name: "description", content: "Review the pieces in your Yesmine cart before checkout." },
      { property: "og:title", content: "Your cart — Yesmine" },
      { property: "og:description", content: "Review your selected Yesmine pieces." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, subtotal, setQuantity, remove } = useCart();
  const { t } = useI18n();
  const shipping = subtotal > 200 || subtotal === 0 ? 0 : 15;

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-soft-gradient" />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal className="mb-10">
          <h1 className="font-display text-4xl sm:text-5xl">{t("cart.title")}</h1>
        </Reveal>

        {items.length === 0 ? (
          <div className="rounded-3xl border bg-card p-16 text-center shadow-soft">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-display text-2xl">{t("cart.empty")}</p>
            <Button variant="hero" size="lg" className="mt-6" asChild>
              <Link to="/shop">{t("nav.shop")}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              {items.map((item) => {
                const key = itemKey(item);
                return (
                  <div
                    key={key}
                    className="flex flex-col gap-4 rounded-3xl border bg-card p-4 shadow-soft sm:flex-row"
                  >
                    <img
                      src={item.image ?? ""}
                      alt={item.name}
                      className="h-40 w-32 shrink-0 rounded-2xl object-cover"
                    />
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            to="/shop/$productSlug"
                            params={{ productSlug: item.slug }}
                            className="font-display text-xl transition-colors hover:text-primary"
                          >
                            {item.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {[item.size, item.color].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(key)}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                          aria-label={t("cart.remove")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-full border p-1">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
                            onClick={() => setQuantity(key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
                            onClick={() => setQuantity(key, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="font-display text-xl text-primary">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <aside className="h-fit space-y-4 rounded-3xl border bg-card p-6 shadow-soft lg:sticky lg:top-24">
              <h2 className="font-display text-2xl">Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
                </div>
              </div>
              <div className="flex items-baseline justify-between border-t pt-4">
                <span className="font-medium">Total</span>
                <span className="font-display text-2xl text-primary">{formatPrice(subtotal + shipping)}</span>
              </div>
              <Button variant="hero" size="lg" className="w-full" asChild>
                <Link to="/checkout">{t("common.checkout")}</Link>
              </Button>
              <Button variant="soft" className="w-full" asChild>
                <Link to="/shop">{t("nav.shop")}</Link>
              </Button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
