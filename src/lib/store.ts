import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Lang } from "@/lib/i18n";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  staleTime: 60_000,
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products", "active"],
  staleTime: 30_000,
  queryFn: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const productBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export type HeroContent = {
  headline_en?: string;
  headline_ru?: string;
  headline_uz?: string;
  sub_en?: string;
  sub_ru?: string;
  sub_uz?: string;
  cta_en?: string;
  cta_ru?: string;
  cta_uz?: string;
  /** The big picture at the top of the landing page, set from the admin panel. */
  image?: string;
};

export type AboutContent = {
  title_en?: string;
  title_ru?: string;
  title_uz?: string;
  body_en?: string;
  body_ru?: string;
  body_uz?: string;
  image?: string;
};
export type Testimonial = {
  name: string;
  city?: string;
  text: string;
  text_ru?: string;
  text_uz?: string;
};

export const contentQuery = queryOptions({
  queryKey: ["site_content"],
  staleTime: 60_000,
  queryFn: async (): Promise<Record<string, unknown>> => {
    const { data, error } = await supabase.from("site_content").select("key,value");
    if (error) throw error;
    const map: Record<string, unknown> = {};
    for (const row of data ?? []) map[row.key] = row.value;
    return map;
  },
});

/** Admin view: includes hidden categories, which the storefront query filters out. */
export const allCategoriesQuery = queryOptions({
  queryKey: ["admin", "categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      .order("name_en");
    if (error) throw error;
    return data ?? [];
  },
});

export type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];

export const variantsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["variants", productId],
    staleTime: 15_000,
    queryFn: async (): Promise<ProductVariant[]> => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Stock for one exact size + colour combination. */
export const variantStock = (
  variants: ProductVariant[],
  size: string | null,
  color: string | null,
) => variants.find((v) => v.size === (size ?? "") && v.color === (color ?? ""))?.stock ?? 0;

/** Total left in a size across every colour (and vice versa) — used to grey out buttons. */
export const stockForSize = (variants: ProductVariant[], size: string) =>
  variants.filter((v) => v.size === size).reduce((n, v) => n + v.stock, 0);

export const stockForColor = (variants: ProductVariant[], color: string) =>
  variants.filter((v) => v.color === color).reduce((n, v) => n + v.stock, 0);

export type PaymentConfig = {
  provider: "demo" | "payme";
  live: boolean;
  merchant_id?: string;
  test_mode?: boolean;
};

/**
 * Whether a real gateway is switched on. The merchant key never leaves the
 * database — only the public merchant id needed to build the checkout link.
 */
export const paymentConfigQuery = queryOptions({
  queryKey: ["payment_config"],
  staleTime: 60_000,
  queryFn: async (): Promise<PaymentConfig> => {
    const { data, error } = await supabase.rpc("payment_config");
    if (error) throw error;
    return (data ?? { provider: "demo", live: false }) as unknown as PaymentConfig;
  },
});

export type ShopSettings = {
  currency: string;
  flat_shipping: number;
  free_shipping_over: number;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  currency: "UZS",
  flat_shipping: 25000,
  free_shipping_over: 1000000,
};

/**
 * Delivery pricing lives in the database so the owner can change it without a
 * deploy. `place_order` reads the same row, so the checkout total a shopper is
 * shown and the total the server charges can never drift apart.
 */
export const shopSettingsQuery = queryOptions({
  queryKey: ["shop_settings"],
  staleTime: 60_000,
  queryFn: async (): Promise<ShopSettings> => {
    const { data, error } = await supabase
      .from("site_content")
      .select("value")
      .eq("key", "shop_settings")
      .maybeSingle();
    if (error) throw error;
    const value = (data?.value ?? {}) as Partial<ShopSettings>;
    return {
      currency: value.currency ?? DEFAULT_SHOP_SETTINGS.currency,
      flat_shipping: Number(value.flat_shipping ?? DEFAULT_SHOP_SETTINGS.flat_shipping),
      free_shipping_over: Number(
        value.free_shipping_over ?? DEFAULT_SHOP_SETTINGS.free_shipping_over,
      ),
    };
  },
});

/** Mirrors public.shipping_for() in SQL — keep the two in step. */
export const shippingFor = (subtotal: number, settings: ShopSettings) => {
  if (subtotal <= 0) return 0;
  return subtotal >= settings.free_shipping_over ? 0 : settings.flat_shipping;
};

/** Shown only when a product has no photo of its own yet. */
export const PRODUCT_PLACEHOLDER =
  "https://images.unsplash.com/photo-1552874869-5c39ec9288dc?w=800&q=80";

export const productImage = (p: Pick<Product, "images">) => p.images?.[0] ?? PRODUCT_PLACEHOLDER;

/**
 * Products keep English in `name`/`description` and translations in
 * `name_ru`/`name_uz` etc. An empty translation falls back to English, so a
 * half-translated catalogue never shows blanks.
 */
export const productName = (
  p: Pick<Product, "name" | "name_ru" | "name_uz">,
  lang: Lang,
): string => {
  if (lang === "ru") return p.name_ru?.trim() || p.name;
  if (lang === "uz") return p.name_uz?.trim() || p.name;
  return p.name;
};

export const productDescription = (
  p: Pick<Product, "description" | "description_ru" | "description_uz">,
  lang: Lang,
): string => {
  if (lang === "ru") return p.description_ru?.trim() || p.description;
  if (lang === "uz") return p.description_uz?.trim() || p.description;
  return p.description;
};

/** Everything a shopper might type into the search box, in every language. */
export const productSearchHaystack = (p: Product) =>
  [p.name, p.name_ru, p.name_uz, p.description, p.description_ru, p.description_uz]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
