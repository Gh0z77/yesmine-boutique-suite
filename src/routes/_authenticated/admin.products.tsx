import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { categoriesQuery, productImage, slugify, type Product } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: AdminProducts,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  description: z.string().trim().max(2000),
  price: z.number().min(0, "Price must be positive"),
  stock: z.number().int().min(0),
});

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  compare_price: string;
  stock: string;
  category_id: string;
  sizes: string;
  colors: string;
  images: string;
  featured: boolean;
  active: boolean;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  price: "",
  compare_price: "",
  stock: "0",
  category_id: "",
  sizes: "XS, S, M, L",
  colors: "Rose",
  images: "",
  featured: false,
  active: true,
};

function AdminProducts() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories } = useQuery(categoriesQuery);
  const { data: products, isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openEdit = (p: Product) =>
    setDraft({
      id: p.id,
      name: p.name,
      description: p.description,
      price: String(p.price),
      compare_price: p.compare_price ? String(p.compare_price) : "",
      stock: String(p.stock),
      category_id: p.category_id ?? "",
      sizes: p.sizes.join(", "),
      colors: p.colors.join(", "),
      images: p.images.join("\n"),
      featured: p.featured,
      active: p.active,
    });

  const save = async () => {
    if (!draft) return;
    const parsed = schema.safeParse({
      name: draft.name,
      description: draft.description,
      price: Number(draft.price),
      stock: Number(draft.stock),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setSaving(true);
    const payload = {
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      description: parsed.data.description,
      price: parsed.data.price,
      compare_price: draft.compare_price ? Number(draft.compare_price) : null,
      stock: parsed.data.stock,
      category_id: draft.category_id || null,
      sizes: draft.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      colors: draft.colors.split(",").map((s) => s.trim()).filter(Boolean),
      images: draft.images.split(/\n+/).map((s) => s.trim()).filter(Boolean),
      featured: draft.featured,
      active: draft.active,
    };

    const { error } = draft.id
      ? await supabase.from("products").update(payload).eq("id", draft.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(draft.id ? "Product updated" : "Product created");
    setDraft(null);
    void queryClient.invalidateQueries();
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Product deleted");
    void queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">{products?.length ?? 0} items</p>
        </div>
        <Button variant="hero" onClick={() => setDraft({ ...emptyDraft })}>
          <Plus className="mr-1.5 h-4 w-4" /> New product
        </Button>
      </div>

      {draft ? (
        <div className="space-y-5 rounded-3xl border bg-card p-6 shadow-elegant">
          <h2 className="font-display text-2xl">{draft.id ? "Edit product" : "New product"}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={draft.name}
                maxLength={120}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={draft.category_id || "none"}
                onValueChange={(v) => setDraft({ ...draft, category_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price (USD)</Label>
              <Input
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Compare price (optional)</Label>
              <Input
                inputMode="decimal"
                value={draft.compare_price}
                onChange={(e) => setDraft({ ...draft, compare_price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stock</Label>
              <Input
                inputMode="numeric"
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sizes (comma separated)</Label>
              <Input
                value={draft.sizes}
                onChange={(e) => setDraft({ ...draft, sizes: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Colors (comma separated)</Label>
              <Input
                value={draft.colors}
                onChange={(e) => setDraft({ ...draft, colors: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.featured}
                  onCheckedChange={(v) => setDraft({ ...draft, featured: v })}
                />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.active}
                  onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                />
                Active
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              maxLength={2000}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Image URLs (one per line)</Label>
            <Textarea
              rows={3}
              value={draft.images}
              onChange={(e) => setDraft({ ...draft, images: e.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="hero" disabled={saving} onClick={save}>
              Save product
            </Button>
            <Button variant="soft" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Product</th>
                <th className="p-4">Price</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(products ?? []).map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="flex items-center gap-3 p-4">
                    <img
                      src={productImage(p)}
                      alt={p.name}
                      className="h-14 w-11 rounded-lg object-cover"
                    />
                    <span className="font-medium">{p.name}</span>
                  </td>
                  <td className="p-4">{formatPrice(Number(p.price))}</td>
                  <td className={cn("p-4", p.stock <= 3 && "text-destructive")}>{p.stock}</td>
                  <td className="p-4">{p.active ? "Active" : "Hidden"}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
