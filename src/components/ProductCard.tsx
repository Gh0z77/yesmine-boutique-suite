import { Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatPrice, useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { CARD_WIDTHS, imageSrc, imageSrcSet } from "@/lib/images";
import { productImage, productName, type Product } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { add } = useCart();
  const { t, lang } = useI18n();
  const soldOut = product.stock <= 0;
  const title = productName(product, lang);
  // More than one size or colour means the shopper must pick a combination that
  // is actually in stock, which only the product page knows.
  const needsChoice = (product.sizes?.length ?? 0) > 1 || (product.colors?.length ?? 0) > 1;

  return (
    <article className={cn("group", className)}>
      <div className="tilt-card overflow-hidden rounded-3xl bg-card shadow-soft">
        <Link
          to="/shop/$productSlug"
          params={{ productSlug: product.slug }}
          className="block overflow-hidden"
          aria-label={title}
        >
          <div className="relative aspect-4/5 overflow-hidden bg-muted">
            <img
              src={imageSrc(productImage(product), 450)}
              srcSet={imageSrcSet(productImage(product), CARD_WIDTHS)}
              sizes="(min-width: 1280px) 380px, (min-width: 640px) 45vw, 90vw"
              alt={title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            {product.compare_price && !soldOut ? (
              <span className="absolute left-3 top-3 rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-on-brand">
                {t("shop.sale")}
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
              {title}
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

          {needsChoice ? (
            // Stock lives per size and colour, and the grid doesn't know which
            // combinations are left. Adding the first of each blindly used to
            // drop a sold-out variant into the cart that checkout then refused
            // and the shopper had no way to correct — so send them to the
            // product page to pick something that actually exists.
            <Button variant="soft" size="sm" className="w-full" disabled={soldOut} asChild>
              <Link to="/shop/$productSlug" params={{ productSlug: product.slug }}>
                {t("shop.chooseOptions")}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button
              variant="soft"
              size="sm"
              className="w-full"
              disabled={soldOut}
              onClick={() => {
                add({
                  productId: product.id,
                  slug: product.slug,
                  name: title,
                  price: Number(product.price),
                  image: productImage(product),
                  size: product.sizes?.[0] ?? null,
                  color: product.colors?.[0] ?? null,
                });
                toast.success(`${title} — ${t("common.addToCart")}`);
              }}
            >
              <ShoppingBag className="mr-1.5 h-4 w-4" />
              {t("common.addToCart")}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
