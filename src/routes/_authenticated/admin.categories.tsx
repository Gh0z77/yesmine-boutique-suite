import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { imageSrc } from "@/lib/images";
import { supabase } from "@/integrations/supabase/client";
import { allCategoriesQuery, slugify, type Category } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: AdminCategories,
});

const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "Slug is required")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug can only use lowercase letters, numbers and dashes"),
  name_en: z.string().trim().min(2, "English name is required").max(80),
  name_ru: z.string().trim().max(80),
  name_uz: z.string().trim().max(80),
  image_url: z.string().trim().url("Image must be a valid URL").max(500).or(z.literal("")),
  sort_order: z.number().int().min(0).max(999),
});

type Draft = {
  id?: string;
  slug: string;
  name_en: string;
  name_ru: string;
  name_uz: string;
  image_url: string;
  sort_order: string;
  active: boolean;
};

const emptyDraft: Draft = {
  slug: "",
  name_en: "",
  name_ru: "",
  name_uz: "",
  image_url: "",
  sort_order: "0",
  active: true,
};

function AdminCategories() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories, isLoading } = useQuery(allCategoriesQuery);

  const { data: counts } = useQuery({
    queryKey: ["admin", "category-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("products").select("category_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.category_id) map[row.category_id] = (map[row.category_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const openEdit = (c: Category) =>
    setDraft({
      id: c.id,
      slug: c.slug,
      name_en: c.name_en,
      name_ru: c.name_ru,
      name_uz: c.name_uz,
      image_url: c.image_url ?? "",
      sort_order: String(c.sort_order),
      active: c.active,
    });

  const save = async () => {
    if (!draft) return;
    const parsed = schema.safeParse({
      slug: draft.slug.trim() || slugify(draft.name_en),
      name_en: draft.name_en,
      name_ru: draft.name_ru,
      name_uz: draft.name_uz,
      image_url: draft.image_url,
      sort_order: Number(draft.sort_order || 0),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }

    setSaving(true);
    const payload = {
      slug: parsed.data.slug,
      name_en: parsed.data.name_en,
      name_ru: parsed.data.name_ru,
      name_uz: parsed.data.name_uz,
      image_url: parsed.data.image_url || null,
      sort_order: parsed.data.sort_order,
      active: draft.active,
    };

    const { error } = draft.id
      ? await supabase.from("categories").update(payload).eq("id", draft.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(
        error.code === "23505"
          ? `The slug "${payload.slug}" is already taken by another category.`
          : error.message,
      );
      return;
    }
    toast.success(draft.id ? "Category updated" : "Category created");
    setDraft(null);
    void queryClient.invalidateQueries();
  };

  const remove = async (c: Category) => {
    const used = counts?.[c.id] ?? 0;
    const warning = used > 0 ? `\n\n${used} product(s) will become uncategorised.` : "";
    if (!window.confirm(`Delete "${c.name_en}"?${warning}`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Category deleted");
    void queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categories?.length ?? 0} collections · shown on the landing page and shop filters
          </p>
        </div>
        <Button variant="hero" onClick={() => setDraft({ ...emptyDraft })}>
          <Plus className="mr-1.5 h-4 w-4" /> New category
        </Button>
      </div>

      {draft ? (
        <div className="space-y-5 rounded-3xl border bg-card p-6 shadow-elegant">
          <h2 className="font-display text-2xl">{draft.id ? "Edit category" : "New category"}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name (EN)</Label>
              <Input
                value={draft.name_en}
                maxLength={80}
                onChange={(e) => {
                  const name_en = e.target.value;
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          name_en,
                          // Only autofill the slug while creating — editing keeps existing links alive.
                          slug: d.id ? d.slug : slugify(name_en),
                        }
                      : d,
                  );
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={draft.slug}
                maxLength={60}
                placeholder="dresses"
                onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">/shop?category={draft.slug || "…"}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Name (RU)</Label>
              <Input
                value={draft.name_ru}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Name (UZ)</Label>
              <Input
                value={draft.name_uz}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name_uz: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input
                inputMode="numeric"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.active}
              onCheckedChange={(v) => setDraft({ ...draft, active: v })}
            />
            Visible in the shop
          </label>

          <ImageUploader
            label="Category image"
            folder="categories"
            max={1}
            value={draft.image_url ? [draft.image_url] : []}
            onChange={(next) => setDraft({ ...draft, image_url: next[0] ?? "" })}
            hint="Shown on the landing page collection cards."
          />

          <div className="flex gap-3">
            <Button variant="hero" disabled={saving} onClick={save}>
              Save category
            </Button>
            <Button variant="soft" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      ) : (categories ?? []).length === 0 ? (
        <div className="rounded-3xl border bg-card p-12 text-center text-muted-foreground">
          No categories yet. Create the first collection above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-4">Category</th>
                <th className="p-4">Slug</th>
                <th className="p-4">Products</th>
                <th className="p-4">Order</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(categories ?? []).map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="flex items-center gap-3 p-4">
                    {c.image_url ? (
                      <img src={imageSrc(c.image_url, 160)} alt="" className="h-14 w-11 rounded-lg object-cover" />
                    ) : (
                      <span className="h-14 w-11 rounded-lg bg-muted" />
                    )}
                    <span>
                      <span className="block font-medium">{c.name_en}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[c.name_ru, c.name_uz].filter(Boolean).join(" · ") || "No translations"}
                      </span>
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{c.slug}</td>
                  <td className="p-4">{counts?.[c.id] ?? 0}</td>
                  <td className="p-4">{c.sort_order}</td>
                  <td className="p-4">{c.active ? "Visible" : "Hidden"}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c)}>
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
