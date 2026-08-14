import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Braces, GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ContactEditor, LegalEditor, ShopSettingsEditor } from "@/components/ContentBlocks";
import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { LANGS, type Lang } from "@/lib/i18n";
import type { Testimonial } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/content")({
  component: AdminContent,
});

type ContentRow = { key: string; value: unknown };
type TranslationRow = { key: string; en: string; ru: string; uz: string };
/** Content blocks are free-form JSON objects of `field_lang` strings. */
type TextBlock = Record<string, string>;

/** Blocks that get a purpose-built editor; anything else falls back to raw JSON. */
const KNOWN_BLOCKS = [
  "hero",
  "about",
  "testimonials",
  "gallery",
  "legal_offer",
  "legal_privacy",
  "legal_returns",
  "shop_settings",
  "contact",
] as const;

/** Legal pages share one editor; the label is all that differs. */
const LEGAL_BLOCKS = [
  { key: "legal_offer", title: "Ommaviy oferta" },
  { key: "legal_privacy", title: "Maxfiylik siyosati" },
  { key: "legal_returns", title: "Qaytarish shartlari" },
] as const;

/** Pulls one block's stored value out of the loaded rows. */
function byKeyValue(
  rows: { key: string; value: unknown }[] | undefined,
  key: string,
): unknown {
  return rows?.find((row) => row.key === key)?.value;
}

function AdminContent() {
  const queryClient = useQueryClient();
  const [lang, setLang] = useState<Lang>("en");

  const [hero, setHero] = useState<TextBlock>({});
  const [about, setAbout] = useState<TextBlock>({});
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [rawBlocks, setRawBlocks] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: content } = useQuery({
    queryKey: ["admin", "content"],
    queryFn: async (): Promise<ContentRow[]> => {
      const { data, error } = await supabase.from("site_content").select("key,value").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Hydrate from the server ONCE. The query refetches after every save, and
  // re-seeding state from it wiped whatever the admin had typed into the other
  // blocks — a headline and a gallery edit vanished when the story was saved.
  const hydrated = useRef(false);

  useEffect(() => {
    if (!content || hydrated.current) return;
    hydrated.current = true;
    const byKey = new Map(content.map((r) => [r.key, r.value]));
    setHero((byKey.get("hero") ?? {}) as TextBlock);
    setAbout((byKey.get("about") ?? {}) as TextBlock);
    setTestimonials(
      Array.isArray(byKey.get("testimonials")) ? (byKey.get("testimonials") as Testimonial[]) : [],
    );
    setGallery(Array.isArray(byKey.get("gallery")) ? (byKey.get("gallery") as string[]) : []);
    setRawBlocks(
      Object.fromEntries(
        content
          .filter((r) => !KNOWN_BLOCKS.includes(r.key as (typeof KNOWN_BLOCKS)[number]))
          .map((r) => [r.key, JSON.stringify(r.value, null, 2)]),
      ),
    );
  }, [content]);

  const saveBlock = async (key: string, value: unknown) => {
    setSavingKey(key);
    const { error } = await supabase
      .from("site_content")
      .upsert({ key, value: value as never, updated_at: new Date().toISOString() });
    setSavingKey(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${key} saved — live on the site now`);
    void queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
    void queryClient.invalidateQueries({ queryKey: ["site_content"] });
  };

  const saveRawBlock = async (key: string) => {
    try {
      await saveBlock(key, JSON.parse(rawBlocks[key] ?? ""));
    } catch {
      toast.error("This block isn't valid JSON yet.");
    }
  };

  const suffix = `_${lang}` as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Landing page copy and interface translations. Changes go live immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Editing</span>
          <div className="flex gap-1 rounded-full border bg-card p-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-all",
                  lang === l.code
                    ? "bg-brand-gradient text-on-brand shadow-soft"
                    : "text-muted-foreground hover:text-primary",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- HERO ---------- */}
      <Block
        title="Hero"
        hint="The first thing a visitor reads, above the fold."
        saving={savingKey === "hero"}
        onSave={() => saveBlock("hero", hero)}
      >
        <div className="space-y-4">
          <Row label={`Headline (${lang.toUpperCase()})`}>
            <Input
              value={hero[`headline${suffix}`] ?? ""}
              maxLength={120}
              onChange={(e) => setHero({ ...hero, [`headline${suffix}`]: e.target.value })}
            />
          </Row>
          <Row label={`Subheadline (${lang.toUpperCase()})`}>
            <Textarea
              rows={3}
              maxLength={400}
              value={hero[`sub${suffix}`] ?? ""}
              onChange={(e) => setHero({ ...hero, [`sub${suffix}`]: e.target.value })}
            />
          </Row>
          <Row label={`Button label (${lang.toUpperCase()})`}>
            <Input
              value={hero[`cta${suffix}`] ?? ""}
              maxLength={40}
              onChange={(e) => setHero({ ...hero, [`cta${suffix}`]: e.target.value })}
            />
          </Row>
          <MissingLanguages
            filled={LANGS.filter((l) => (hero[`headline_${l.code}`] ?? "").trim()).map(
              (l) => l.code,
            )}
          />
          <ImageUploader
            label="Bosh rasm"
            folder="content"
            max={1}
            value={hero["image"] ? [hero["image"]] : []}
            onChange={(next) => setHero({ ...hero, image: next[0] ?? "" })}
            hint="Sahifaning eng tepasidagi katta rasm. Tik (portret) format yaxshi ko'rinadi."
          />
        </div>
      </Block>

      {/* ---------- ABOUT ---------- */}
      <Block
        title="Story"
        hint="The image + text split halfway down the landing page."
        saving={savingKey === "about"}
        onSave={() => saveBlock("about", about)}
      >
        <div className="space-y-4">
          <ImageUploader
            label="Story image"
            folder="content"
            max={1}
            value={about["image"] ? [about["image"]] : []}
            onChange={(next) => setAbout({ ...about, image: next[0] ?? "" })}
            hint="Shown beside the story text on the landing page."
          />
          <Row label={`Title (${lang.toUpperCase()})`}>
            <Input
              value={about[`title${suffix}`] ?? ""}
              maxLength={120}
              onChange={(e) => setAbout({ ...about, [`title${suffix}`]: e.target.value })}
            />
          </Row>
          <Row label={`Body (${lang.toUpperCase()})`}>
            <Textarea
              rows={5}
              maxLength={1200}
              value={about[`body${suffix}`] ?? ""}
              onChange={(e) => setAbout({ ...about, [`body${suffix}`]: e.target.value })}
            />
          </Row>
          <MissingLanguages
            filled={LANGS.filter((l) => (about[`body_${l.code}`] ?? "").trim()).map((l) => l.code)}
          />
        </div>
      </Block>

      {/* ---------- TESTIMONIALS ---------- */}
      <Block
        title="Testimonials"
        hint="Shown one at a time in the review carousel."
        saving={savingKey === "testimonials"}
        onSave={() => saveBlock("testimonials", testimonials)}
      >
        <div className="space-y-4">
          {testimonials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No testimonials yet.</p>
          ) : null}
          {testimonials.map((item, index) => (
            <div key={index} className="space-y-3 rounded-2xl border bg-background p-4">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  #{index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  aria-label="Remove testimonial"
                  onClick={() => setTestimonials(testimonials.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={item.name}
                  maxLength={60}
                  placeholder="Name"
                  onChange={(e) =>
                    setTestimonials(
                      testimonials.map((t, i) =>
                        i === index ? { ...t, name: e.target.value } : t,
                      ),
                    )
                  }
                />
                <Input
                  value={item.city ?? ""}
                  maxLength={60}
                  placeholder="City"
                  onChange={(e) =>
                    setTestimonials(
                      testimonials.map((t, i) =>
                        i === index ? { ...t, city: e.target.value } : t,
                      ),
                    )
                  }
                />
              </div>
              <Textarea
                rows={3}
                maxLength={400}
                value={item.text}
                placeholder="What they said"
                onChange={(e) =>
                  setTestimonials(
                    testimonials.map((t, i) => (i === index ? { ...t, text: e.target.value } : t)),
                  )
                }
              />
            </div>
          ))}
          <Button
            variant="soft"
            size="sm"
            onClick={() => setTestimonials([...testimonials, { name: "", city: "", text: "" }])}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add testimonial
          </Button>
        </div>
      </Block>

      {/* ---------- GALLERY ---------- */}
      <Block
        title="Lookbook gallery"
        hint="The Instagram-style grid near the bottom of the landing page."
        saving={savingKey === "gallery"}
        onSave={() =>
          saveBlock(
            "gallery",
            gallery.filter((url) => url.trim()),
          )
        }
      >
        <ImageUploader
          label="Gallery images"
          folder="gallery"
          max={12}
          value={gallery}
          onChange={setGallery}
          hint="Square crops look best in the lookbook grid."
        />
      </Block>

      {/* ---------- LEGAL PAGES ---------- */}
      {LEGAL_BLOCKS.map((block) => (
        <LegalEditor
          key={block.key}
          blockKey={block.key}
          title={block.title}
          initial={(byKeyValue(content, block.key) ?? {}) as Record<string, unknown>}
        />
      ))}

      {/* ---------- CONTACT ---------- */}
      <ContactEditor
        initial={(byKeyValue(content, "contact") ?? {}) as Record<string, unknown>}
      />

      {/* ---------- SHOP SETTINGS ---------- */}
      <ShopSettingsEditor
        initial={(byKeyValue(content, "shop_settings") ?? {}) as Record<string, unknown>}
      />

      {/* ---------- ANY OTHER BLOCK ---------- */}
      {Object.keys(rawBlocks).map((key) => (
        <Block
          key={key}
          title={key}
          hint="Custom block — edited as raw JSON."
          saving={savingKey === key}
          onSave={() => saveRawBlock(key)}
        >
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Braces className="h-3.5 w-3.5" /> Must be valid JSON.
            </p>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={rawBlocks[key] ?? ""}
              onChange={(e) => setRawBlocks((d) => ({ ...d, [key]: e.target.value }))}
            />
          </div>
        </Block>
      ))}

      <TranslationsEditor />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Block({
  title,
  hint,
  saving,
  onSave,
  children,
}: {
  title: string;
  hint: string;
  saving: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl capitalize">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button variant="hero" size="sm" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Nudges the admin toward the languages they haven't filled in yet. */
function MissingLanguages({ filled }: { filled: Lang[] }) {
  const missing = LANGS.filter((l) => !filled.includes(l.code));
  if (missing.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Not translated yet: {missing.map((l) => l.label).join(", ")} — visitors on those languages see
      the English copy.
    </p>
  );
}

/* ------------------------------------------------------------------ */

function TranslationsEditor() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [filter, setFilter] = useState("");
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: strings } = useQuery({
    queryKey: ["admin", "translations"],
    queryFn: async (): Promise<TranslationRow[]> => {
      const { data, error } = await supabase
        .from("translations")
        .select("key,en,ru,uz")
        .order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Same trap as the content blocks: refetching after one row is saved used to
  // reset every other row the admin was still editing.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!strings || hydrated.current) return;
    hydrated.current = true;
    setRows(strings);
  }, [strings]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.key.toLowerCase().includes(q) ||
        r.en.toLowerCase().includes(q) ||
        r.ru.toLowerCase().includes(q) ||
        r.uz.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "translations"] });
    void queryClient.invalidateQueries({ queryKey: ["translations"] });
  };

  const save = async (row: TranslationRow) => {
    setBusy(true);
    // upsert, so a key added here survives even if the row was never seeded.
    const { error } = await supabase
      .from("translations")
      .upsert({ ...row, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${row.key} saved`);
    refresh();
  };

  const addKey = async () => {
    const key = newKey.trim();
    if (!/^[a-z0-9]+(\.[a-z0-9A-Z]+)+$/.test(key)) {
      toast.error("Use a dotted key such as shop.newLabel");
      return;
    }
    if (rows.some((r) => r.key === key)) {
      toast.error("That key already exists.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("translations").insert({ key, en: "", ru: "", uz: "" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewKey("");
    toast.success(`${key} added`);
    refresh();
  };

  const remove = async (key: string) => {
    if (!window.confirm(`Delete "${key}"? The built-in English fallback will be used instead.`))
      return;
    const { error } = await supabase.from("translations").delete().eq("key", key);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${key} deleted`);
    refresh();
  };

  return (
    <section className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
      <div>
        <h2 className="font-display text-xl">Interface translations</h2>
        <p className="text-sm text-muted-foreground">
          Every label used across the storefront. An empty field falls back to English.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter keys or text…"
          className="h-10 w-full rounded-full sm:w-64"
        />
        <div className="flex flex-1 gap-2">
          <Input
            value={newKey}
            maxLength={80}
            placeholder="new.key"
            className="h-10"
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addKey();
            }}
          />
          <Button variant="soft" disabled={busy} onClick={addKey}>
            <Plus className="mr-1.5 h-4 w-4" /> Add key
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="hidden gap-3 px-1 text-xs uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[12rem_1fr_1fr_1fr_auto]">
          <span>Key</span>
          <span>English</span>
          <span>Русский</span>
          <span>O'zbekcha</span>
          <span />
        </div>
        {visible.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No keys match "{filter}".</p>
        ) : null}
        {visible.map((row) => (
          <div
            key={row.key}
            className="grid gap-3 border-t pt-3 sm:grid-cols-[12rem_1fr_1fr_1fr_auto]"
          >
            <p className="self-center break-all font-mono text-xs text-muted-foreground">
              {row.key}
            </p>
            {(["en", "ru", "uz"] as const).map((code) => (
              <Input
                key={code}
                value={row[code]}
                maxLength={300}
                aria-label={`${row.key} ${code}`}
                onChange={(e) =>
                  setRows((list) =>
                    list.map((r) => (r.key === row.key ? { ...r, [code]: e.target.value } : r)),
                  )
                }
              />
            ))}
            <div className="flex gap-1">
              <Button variant="soft" size="sm" disabled={busy} onClick={() => save(row)}>
                Save
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${row.key}`}
                onClick={() => remove(row.key)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
