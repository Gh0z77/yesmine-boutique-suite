import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

/**
 * Legal pages and shop settings used to be edited as raw JSON, which meant a
 * misplaced comma silently broke a live page. They are ordinary forms now —
 * the JSON is assembled here, where it cannot be mistyped.
 */

type Json = Record<string, unknown>;

const LANGS = [
  { code: "uz", label: "O'zbekcha" },
  { code: "ru", label: "Ruscha" },
  { code: "en", label: "Inglizcha" },
] as const;

async function saveBlock(key: string, value: Json): Promise<boolean> {
  const { error } = await supabase
    .from("site_content")
    .upsert({ key, value: value as never, updated_at: new Date().toISOString() });
  if (error) {
    toast.error(error.message);
    return false;
  }
  toast.success("Saqlandi");
  return true;
}

function Shell({
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
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className="font-display text-xl">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button variant="hero" className="ml-auto" disabled={saving} onClick={onSave}>
          {saving ? "Saqlanmoqda…" : "Saqlash"}
        </Button>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Legal pages                                                        */
/* ------------------------------------------------------------------ */

export function LegalEditor({
  blockKey,
  title,
  initial,
}: {
  blockKey: string;
  title: string;
  initial: Json;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    for (const { code } of LANGS) {
      start[`title_${code}`] = (initial[`title_${code}`] as string) ?? "";
      start[`body_${code}`] = (initial[`body_${code}`] as string) ?? "";
    }
    return start;
  });

  const set = (field: string, value: string) => setDraft((d) => ({ ...d, [field]: value }));

  const save = async () => {
    setSaving(true);
    const value: Json = { ...draft, updated: new Date().toISOString().slice(0, 10) };
    const ok = await saveBlock(blockKey, value);
    setSaving(false);
    if (ok) void queryClient.invalidateQueries({ queryKey: ["content"] });
  };

  return (
    <Shell
      title={title}
      hint="Sarlavha va matnni to'g'ridan-to'g'ri yozing. Har bir til alohida."
      saving={saving}
      onSave={save}
    >
      <div className="space-y-6">
        {LANGS.map(({ code, label }) => (
          <div key={code} className="space-y-3 rounded-2xl border p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <div className="space-y-1.5">
              <Label>Sarlavha</Label>
              <Input
                maxLength={160}
                value={draft[`title_${code}`] ?? ""}
                onChange={(e) => set(`title_${code}`, e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Matn</Label>
              <Textarea
                rows={12}
                value={draft[`body_${code}`] ?? ""}
                onChange={(e) => set(`body_${code}`, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Yangi qatordan yozsangiz, sahifada ham yangi qator bo'ladi.
              </p>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/*  Shop settings                                                      */
/* ------------------------------------------------------------------ */

export function ShopSettingsEditor({ initial }: { initial: Json }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [flat, setFlat] = useState(String(initial["flat_shipping"] ?? 0));
  const [free, setFree] = useState(String(initial["free_shipping_over"] ?? 0));
  const currency = (initial["currency"] as string) ?? "UZS";

  const save = async () => {
    setSaving(true);
    const ok = await saveBlock("shop_settings", {
      currency,
      flat_shipping: Number(flat || 0),
      free_shipping_over: Number(free || 0),
    });
    setSaving(false);
    if (ok) void queryClient.invalidateQueries({ queryKey: ["content"] });
  };

  const money = (value: string) =>
    Number(value || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return (
    <Shell
      title="Do'kon sozlamalari"
      hint="Yetkazib berish narxi va bepul yetkazish chegarasi."
      saving={saving}
      onSave={save}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Yetkazib berish narxi (so'm)</Label>
          <Input inputMode="numeric" value={flat} onChange={(e) => setFlat(e.target.value)} />
          <p className="text-xs text-muted-foreground">{money(flat)} so'm</p>
        </div>
        <div className="space-y-1.5">
          <Label>Shu summadan yuqorida bepul (so'm)</Label>
          <Input inputMode="numeric" value={free} onChange={(e) => setFree(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {Number(free || 0) > 0 ? `${money(free)} so'mdan yuqorida bepul` : "Bepul yetkazish yo'q"}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Valyuta: {currency}</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/*  Contact details                                                    */
/* ------------------------------------------------------------------ */

/**
 * Phone, address, hours and map pin used to be typed into the page code, so
 * changing a phone number meant a code change — and the footer and contact
 * page had drifted to two different addresses. One block feeds both now.
 */
export function ContactEditor({ initial }: { initial: Json }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {
      phone: (initial["phone"] as string) ?? "",
      email: (initial["email"] as string) ?? "",
      telegram: (initial["telegram"] as string) ?? "",
      instagram: (initial["instagram"] as string) ?? "",
      lat: String(initial["lat"] ?? ""),
      lng: String(initial["lng"] ?? ""),
    };
    for (const { code } of LANGS) {
      start[`address_${code}`] = (initial[`address_${code}`] as string) ?? "";
      start[`hours_${code}`] = (initial[`hours_${code}`] as string) ?? "";
    }
    return start;
  });

  const set = (field: string, value: string) => setDraft((d) => ({ ...d, [field]: value }));

  const save = async () => {
    setSaving(true);
    const ok = await saveBlock("contact", {
      ...draft,
      lat: Number(draft["lat"] || 0),
      lng: Number(draft["lng"] || 0),
    });
    setSaving(false);
    if (ok) void queryClient.invalidateQueries({ queryKey: ["content"] });
  };

  return (
    <Shell
      title="Aloqa ma'lumotlari"
      hint="Bu yerda o'zgartirsangiz, aloqa sahifasida ham, pastki qismda ham yangilanadi."
      saving={saving}
      onSave={save}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input
              maxLength={40}
              value={draft["phone"] ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              maxLength={120}
              value={draft["email"] ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telegram havolasi</Label>
            <Input
              maxLength={160}
              placeholder="https://t.me/yesmine"
              value={draft["telegram"] ?? ""}
              onChange={(e) => set("telegram", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Instagram havolasi</Label>
            <Input
              maxLength={160}
              placeholder="https://instagram.com/yesmine"
              value={draft["instagram"] ?? ""}
              onChange={(e) => set("instagram", e.target.value)}
            />
          </div>
        </div>

        {LANGS.map(({ code, label }) => (
          <div key={code} className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground sm:col-span-2">
              {label}
            </p>
            <div className="space-y-1.5">
              <Label>Manzil</Label>
              <Input
                maxLength={200}
                value={draft[`address_${code}`] ?? ""}
                onChange={(e) => set(`address_${code}`, e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ish vaqti</Label>
              <Input
                maxLength={120}
                value={draft[`hours_${code}`] ?? ""}
                onChange={(e) => set(`hours_${code}`, e.target.value)}
              />
            </div>
          </div>
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Xarita — kenglik (lat)</Label>
            <Input value={draft["lat"] ?? ""} onChange={(e) => set("lat", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Xarita — uzunlik (lng)</Label>
            <Input value={draft["lng"] ?? ""} onChange={(e) => set("lng", e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Koordinatani Google Xaritadan olasiz: kerakli joyni bosib turing, chiqqan raqamlarni shu
          yerga ko&apos;chiring.
        </p>
      </div>
    </Shell>
  );
}
