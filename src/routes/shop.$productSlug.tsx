import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { formatPrice, useCart } from "@/lib/cart";
import { CARD_WIDTHS, HERO_WIDTHS, imageSrc, imageSrcSet, THUMB_WIDTHS } from "@/lib/images";
import { useI18n } from "@/lib/i18n";
import { shopSettingsQuery } from "@/lib/store";
import {
  productBySlugQuery,
  productDescription,
  productImage,
  productName,
  productsQuery,
  stockForColor,
  stockForSize,
  variantsQuery,
  variantStock,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shop/$productSlug")({
  loader: async ({ context, params }) => {
    const [product, products] = await Promise.all([
      context.queryClient.ensureQueryData(productBySlugQuery(params.productSlug)),
      context.queryClient.ensureQueryData(productsQuery),
    ]);
    const variants = product
      ? await context.queryClient.ensureQueryData(variantsQuery(product.id))
      : [];
    return { product, products, variants };
  },
  head: ({ params }) => {
    const name = params.productSlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return {
      meta: [
        { title: `${name} — Yesmine` },
        {
          name: "description",
          content: `${name} from the Yesmine atelier. Small-run womenswear, finished by hand.`,
        },
        { property: "og:title", content: `${name} — Yesmine` },
        { property: "og:description", content: `${name} from the Yesmine atelier.` },
      ],
    };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const { productSlug } = Route.useParams();
  const { t, lang } = useI18n();
  const { add } = useCart();
  const seed = Route.useLoaderData();
  const { data: product, isLoading } = useQuery({
    ...productBySlugQuery(productSlug),
    initialData: seed.product,
  });
  const { data: products } = useQuery({ ...productsQuery, initialData: seed.products });
  const { data: settings } = useQuery(shopSettingsQuery);
  const { data: variants = [] } = useQuery({
    ...variantsQuery(seed.product?.id ?? ""),
    initialData: seed.variants,
    enabled: Boolean(seed.product?.id),
  });

  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-4/5 animate-pulse rounded-3xl bg-muted" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-1/3 animate-pulse rounded-full bg-muted" />
            <div className="h-32 animate-pulse rounded-3xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <h1 className="font-display text-3xl">{t("shop.notFound")}</h1>
        <p className="mt-3 text-muted-foreground">{t("shop.notFoundBody")}</p>
        <Button variant="hero" className="mt-6" asChild>
          <Link to="/shop">{t("nav.shop")}</Link>
        </Button>
      </div>
    );
  }

  const title = productName(product, lang);
  const description = productDescription(product, lang);
  const images = product.images.length > 0 ? product.images : [productImage(product)];
  const related = (products ?? [])
    .filter((p) => p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 4);

  // Land on something the shopper can actually buy: the first combination
  // with stock, rather than whichever size happens to be listed first.
  const inStock = variants.find((v) => v.stock > 0);
  const activeSize = size ?? inStock?.size ?? product.sizes[0] ?? null;
  const activeColor = color ?? inStock?.color ?? product.colors[0] ?? null;

  // Stock is per size + colour now, so the whole page reacts to the selection.
  const selectedStock = variantStock(variants, activeSize, activeColor);
  const soldOut = selectedStock <= 0;

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-soft-gradient" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> {t("nav.shop")}
        </Link>

        <div className="mt-6 grid gap-12 lg:grid-cols-2">
          <Reveal className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] bg-muted shadow-elegant">
              <img
                src={imageSrc(images[imageIndex] ?? images[0], 900)}
                srcSet={imageSrcSet(images[imageIndex] ?? images[0], HERO_WIDTHS)}
                sizes="(min-width: 1024px) 45vw, 92vw"
                alt={title}
                fetchPriority="high"
                decoding="async"
                className="aspect-4/5 w-full object-cover"
              />
            </div>
            {images.length > 1 ? (
              <div className="flex gap-3">
                {images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setImageIndex(i)}
                    className={cn(
                      "h-24 w-20 overflow-hidden rounded-xl border-2 transition-all",
                      i === imageIndex
                        ? "border-primary"
                        : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <img
                      src={imageSrc(src, 160)}
                      srcSet={imageSrcSet(src, THUMB_WIDTHS)}
                      sizes="80px"
                      alt={`${title} — ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </Reveal>

          <Reveal delay={100} className="space-y-7">
            <div className="space-y-3">
              <h1 className="font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl text-primary">
                  {formatPrice(Number(product.price))}
                </span>
                {product.compare_price ? (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(Number(product.compare_price))}
                  </span>
                ) : null}
              </div>
              <p
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  soldOut ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground",
                )}
              >
                <Check className="h-3.5 w-3.5" />
                {soldOut
                  ? product.stock > 0
                    ? t("shop.variantOut")
                    : t("shop.outOfStock")
                  : `${t("shop.inStock")} — ${selectedStock}`}
              </p>
            </div>

            <p className="text-lg leading-relaxed text-muted-foreground">{description}</p>

            {product.sizes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                  {t("shop.size")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => {
                    const available = stockForSize(variants, s) > 0;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={!available}
                        title={available ? undefined : t("shop.outOfStock")}
                        onClick={() => setSize(s)}
                        className={cn(
                          "min-w-12 rounded-full border px-4 py-2 text-sm transition-all",
                          activeSize === s
                            ? "border-transparent bg-brand-gradient text-on-brand shadow-soft"
                            : "border-border hover:border-primary/50 hover:text-primary",
                          !available &&
                            "cursor-not-allowed border-dashed text-muted-foreground/50 line-through hover:border-border hover:text-muted-foreground/50",
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {product.colors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                  {t("shop.color")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((c) => {
                    const available = stockForColor(variants, c) > 0;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={!available}
                        title={available ? undefined : t("shop.outOfStock")}
                        onClick={() => setColor(c)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-all",
                          activeColor === c
                            ? "border-transparent bg-brand-gradient text-on-brand shadow-soft"
                            : "border-border hover:border-primary/50 hover:text-primary",
                          !available &&
                            "cursor-not-allowed border-dashed text-muted-foreground/50 line-through hover:border-border hover:text-muted-foreground/50",
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1 rounded-full border p-1">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center">{quantity}</span>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, selectedStock), q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                variant="hero"
                size="xl"
                disabled={soldOut}
                className="flex-1"
                onClick={() => {
                  add(
                    {
                      productId: product.id,
                      slug: product.slug,
                      name: title,
                      price: Number(product.price),
                      image: images[0] ?? null,
                      size: activeSize,
                      color: activeColor,
                    },
                    quantity,
                  );
                  toast.success(`${title} — ${t("common.addToCart")}`);
                }}
              >
                <ShoppingBag className="mr-1.5 h-4 w-4" /> {t("common.addToCart")}
              </Button>
            </div>

            <div className="grid gap-3 rounded-3xl border bg-card p-5 text-sm text-muted-foreground sm:grid-cols-2">
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" /> {t("shop.freeDeliveryOver")}{" "}
                {formatPrice(settings?.free_shipping_over ?? 1000000)}
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> {t("shop.returns")}
              </span>
            </div>
          </Reveal>
        </div>

        {related.length > 0 ? (
          <section className="mt-24">
            <Reveal className="mb-8">
              <h2 className="font-display text-3xl sm:text-4xl">{t("shop.related")}</h2>
            </Reveal>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
