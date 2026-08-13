import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
      const { data, error } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
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
};

export type AboutContent = { title_en?: string; body_en?: string; image?: string };
export type Testimonial = { name: string; city?: string; text: string };

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

export const PRODUCT_PLACEHOLDER =
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80";

export const productImage = (p: Pick<Product, "images">) => p.images?.[0] ?? PRODUCT_PLACEHOLDER;

export const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
