import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatPrice } from "@/lib/cart";
import { localized, useI18n } from "@/lib/i18n";
import { categoriesQuery, productSearchHaystack, productsQuery } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Uzum-style: a manageable first page, then "load more" on demand. */
const PAGE_SIZE = 12;

type Search = {
  q?: string | undefined;
  category?: string | undefined;
  size?: string | undefined;
  color?: string | undefined;
  sort?: "newest" | "popular" | "price-asc" | "price-desc" | undefined;
  max?: number | undefined;
};

export const Route = createFileRoute("/shop/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    category: typeof search["category"] === "string" ? search["category"] : undefined,
    size: typeof search["size"] === "string" ? search["size"] : undefined,
    color: typeof search["color"] === "string" ? search["color"] : undefined,
    sort: ["newest", "popular", "price-asc", "price-desc"].includes(String(search["sort"]))
      ? (search["sort"] as Search["sort"])
      : undefined,
    max:
      Number.isFinite(Number(search["max"])) && search["max"] !== undefined
        ? Number(search["max"])
        : undefined,
  }),
  loader: async ({ context }) => {
    const [products, categories] = await Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]);
    return { products, categories };
  },
  head: () => ({
    meta: [
      { title: "Do'kon — Yesmine ayollar kiyimi" },
      {
        name: "description",
        content:
          "Browse the full Yesmine collection: silk dresses, wool coats, knitwear and hand-finished accessories, filterable by size, colour and price.",
      },
      { property: "og:title", content: "Do'kon — Yesmine ayollar kiyimi" },
      {
        property: "og:description",
        content: "Silk dresses, wool coats and accessories in Yesmine's signature rose palette.",
      },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { t, lang } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const seed = Route.useLoaderData();
  const { data: products, isLoading } = useQuery({ ...productsQuery, initialData: seed.products });
  const { data: categories } = useQuery({ ...categoriesQuery, initialData: seed.categories });
  const [mobileFilters, setMobileFilters] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const set = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  // Stable identity, so the filter/sort memos below don't rerun on every render.
  const all = useMemo(() => products ?? [], [products]);
  const maxPrice = useMemo(() => Math.max(100, ...all.map((p) => Number(p.price))), [all]);
  const priceCap = search.max ?? maxPrice;

  const sizes = useMemo(() => [...new Set(all.flatMap((p) => p.sizes))].sort(), [all]);
  const colors = useMemo(() => [...new Set(all.flatMap((p) => p.colors))].sort(), [all]);

  const categoryId = categories?.find((c) => c.slug === search.category)?.id;

  const filtered = useMemo(() => {
    let list = all;
    if (search.q) {
      const q = search.q.toLowerCase();
      // Search matches any language, so a Russian query finds an English name too.
      list = list.filter((p) => productSearchHaystack(p).includes(q));
    }
    if (categoryId) list = list.filter((p) => p.category_id === categoryId);
    if (search.size) list = list.filter((p) => p.sizes.includes(search.size!));
    if (search.color) list = list.filter((p) => p.colors.includes(search.color!));
    list = list.filter((p) => Number(p.price) <= priceCap);

    const sorted = [...list];
    switch (search.sort) {
      case "price-asc":
        sorted.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-desc":
        sorted.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "popular":
        sorted.sort((a, b) => b.sold_count - a.sold_count);
        break;
      default:
        break;
    }
    return sorted;
  }, [all, search.q, search.size, search.color, search.sort, categoryId, priceCap]);

  // A new filter should start the shopper back at the top of the results.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [search.q, search.category, search.size, search.color, search.sort, search.max]);

  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  const hasFilters = Boolean(
    search.q || search.category || search.size || search.color || search.max || search.sort,
  );

  const filterPanel = (
    <div className="space-y-8">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
          {t("shop.category")}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Chip active={!search.category} onClick={() => set({ category: undefined })}>
            {t("shop.all")}
          </Chip>
          {(categories ?? []).map((c) => (
            <Chip
              key={c.id}
              active={search.category === c.slug}
              onClick={() => set({ category: search.category === c.slug ? undefined : c.slug })}
            >
              {localized(c, "name", lang)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
          {t("shop.size")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <Chip
              key={s}
              active={search.size === s}
              onClick={() => set({ size: search.size === s ? undefined : s })}
            >
              {s}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
          {t("shop.color")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {colors.map((c) => (
            <Chip
              key={c}
              active={search.color === c}
              onClick={() => set({ color: search.color === c ? undefined : c })}
            >
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
          {t("shop.price")}
        </h3>
        <Slider
          value={[priceCap]}
          min={0}
          max={maxPrice}
          step={10}
          onValueChange={([v]) => set({ max: v })}
        />
        <p className="text-sm text-muted-foreground">
          {t("shop.upTo")} {formatPrice(priceCap)}
        </p>
      </div>

      {hasFilters ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            navigate({
              search: {},
              replace: true,
            })
          }
        >
          <X className="mr-1 h-3.5 w-3.5" /> {t("shop.clearFilters")}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-soft-gradient" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Reveal className="mb-10 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("shop.eyebrow")}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">{t("shop.title")}</h1>
          <p className="max-w-xl text-muted-foreground">
            {filtered.length} {t("shop.pieces")}
          </p>
        </Reveal>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Input
            value={search.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder={t("common.search")}
            aria-label={t("common.search")}
            maxLength={100}
            className="h-11 w-full rounded-full sm:w-72"
          />

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["newest", t("shop.newest")],
                ["popular", t("shop.popular")],
                ["price-asc", t("shop.priceLow")],
                ["price-desc", t("shop.priceHigh")],
              ] as const
            ).map(([value, label]) => (
              <Chip
                key={value}
                active={(search.sort ?? "newest") === value}
                onClick={() => set({ sort: value })}
              >
                {label}
              </Chip>
            ))}
          </div>

          <Button
            variant="soft"
            className="ml-auto lg:hidden"
            onClick={() => setMobileFilters((v) => !v)}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" /> {t("shop.filters")}
          </Button>
        </div>

        <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
          <aside className={cn("lg:block", mobileFilters ? "block" : "hidden")}>
            <div className="rounded-3xl border bg-card p-6 shadow-soft lg:sticky lg:top-24">
              {filterPanel}
            </div>
          </aside>

          <div>
            {isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-4/5 animate-pulse rounded-3xl bg-muted" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border bg-card p-16 text-center">
                <p className="font-display text-2xl">{t("shop.empty")}</p>
              </div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((p, i) => (
                    <Reveal key={p.id} delay={Math.min(i % PAGE_SIZE, 6) * 60}>
                      <ProductCard product={p} />
                    </Reveal>
                  ))}
                </div>

                <div className="mt-12 flex flex-col items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    {shown.length} / {filtered.length}
                  </p>
                  {shown.length < filtered.length ? (
                    <Button
                      variant="soft"
                      size="lg"
                      onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    >
                      {t("shop.loadMore")}
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-all duration-300",
        active
          ? "border-transparent bg-brand-gradient text-on-brand shadow-soft"
          : "border-border bg-card text-foreground/80 hover:border-primary/40 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
