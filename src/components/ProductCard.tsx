import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatPrice, useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { productImage, type Product } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { add } = useCart();
  const { t } = useI18n();
  const soldOut = product.stock <= 0;

  return (
    <article className={cn("group", className)}>
      <div className="tilt-card overflow-hidden rounded-3xl bg-card shadow-soft">
        <Link
          to="/shop/$productSlug"
          params={{ productSlug: product.slug }}
          className="block overflow-hidden"
          aria-label={product.name}
        >
          <div className="relative aspect-4/5 overflow-hidden bg-muted">
            <img
              src={productImage(product)}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            {product.compare_price && !soldOut ? (
              <span className="absolute left-3 top-3 rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-brand">
                Sale
              </span>
            ) : null}
            {soldOut ? (
              <span className="absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-brand">
                {t("shop.outOfStock")}
              </span>
            ) : null}
          </div>
        </Link>

        <div className="space-y-3 p-4">
          <div className="space-y-1">
            <Link
              to="/shop/$productSlug"
              params={{ productSlug: product.slug }}
              className="line-clamp-1 font-display text-lg text-foreground transition-colors hover:text-primary"
            >
              {product.name}
            </Link>
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-primary">{formatPrice(Number(product.price))}</span>
              {product.compare_price ? (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(Number(product.compare_price))}
                </span>
              ) : null}
            </div>
          </div>

          <Button
            variant="soft"
            size="sm"
            className="w-full"
            disabled={soldOut}
            onClick={() => {
              add({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                price: Number(product.price),
                image: productImage(product),
                size: product.sizes?.[0] ?? null,
                color: product.colors?.[0] ?? null,
              });
              toast.success(`${product.name} — ${t("common.addToCart")}`);
            }}
          >
            <ShoppingBag className="mr-1.5 h-4 w-4" />
            {t("common.addToCart")}
          </Button>
        </div>
      </div>
    </article>
  );
}
