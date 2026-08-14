import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CreditCard, Copy, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SocialSettings } from "@/components/SocialSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPayments,
});

type PaymeConfig = { merchant_id: string; key: string; test_mode: boolean };
type PaymentsConfig = { provider: "demo" | "payme"; payme: PaymeConfig };

const EMPTY: PaymentsConfig = {
  provider: "demo",
  payme: { merchant_id: "", key: "", test_mode: true },
};

type TelegramConfig = { bot_token: string; chat_id: string; enabled: boolean };

/** Bot token + chat id for the "new order" ping. Admin-only, never public. */
function TelegramSettings() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<TelegramConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "telegram"],
    queryFn: async (): Promise<TelegramConfig> => {
      const { data: row, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "telegram")
        .maybeSingle();
      if (error) throw error;
      const value = (row?.value ?? {}) as Partial<TelegramConfig>;
      return {
        bot_token: value.bot_token ?? "",
        chat_id: value.chat_id ?? "",
        enabled: Boolean(value.enabled),
      };
    },
  });

  const config = draft ?? data ?? { bot_token: "", chat_id: "", enabled: false };

  // Xabarnoma jimgina ishlamay qolmasligi uchun oxirgi urinishlar ko'rsatiladi.
  const { data: log } = useQuery({
    queryKey: ["admin", "notification_log"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("notification_log")
        .select("id, ok, error, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return rows ?? [];
    },
  });

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "telegram", value: config as never, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft(null);
    toast.success("Telegram settings saved");
    void queryClient.invalidateQueries({ queryKey: ["admin", "telegram"] });
  };

  const test = async () => {
    setBusy(true);
    const { data: result, error } = await supabase.rpc("telegram_test");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const outcome = result as unknown as { ok: boolean; message: string };
    if (outcome?.ok) toast.success(outcome.message);
    else toast.error(outcome?.message ?? "Test failed");
  };

  return (
    <section className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Send className="h-5 w-5 text-primary" /> Telegram notifications
        </h2>
        <p className="text-sm text-muted-foreground">
          Get a message the moment an order lands. Create a bot with @BotFather, then send your bot
          any message and open api.telegram.org/bot&lt;TOKEN&gt;/getUpdates to find your chat id.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Bot token</Label>
          <Input
            type="password"
            value={config.bot_token}
            maxLength={200}
            placeholder="123456:ABC-DEF…"
            autoComplete="off"
            onChange={(e) => setDraft({ ...config, bot_token: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Chat id</Label>
          <Input
            value={config.chat_id}
            maxLength={60}
            placeholder="123456789"
            onChange={(e) => setDraft({ ...config, chat_id: e.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => setDraft({ ...config, enabled: v })}
        />
        Send a message for every new order
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="hero" size="sm" disabled={busy} onClick={save}>
          Save
        </Button>
        <Button variant="soft" size="sm" disabled={busy} onClick={test}>
          Send test message
        </Button>
      </div>

      {(log ?? []).length > 0 ? (
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Oxirgi urinishlar
          </p>
          <ul className="space-y-1.5 text-sm">
            {(log ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    row.ok ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {row.ok ? "Yuborildi" : "Xato"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("uz-UZ")}
                </span>
                {row.error ? (
                  <span className="w-full break-words text-xs text-destructive">{row.error}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function AdminPayments() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PaymentsConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: stored } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async (): Promise<PaymentsConfig> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "payments")
        .maybeSingle();
      if (error) throw error;
      const value = (data?.value ?? {}) as Partial<PaymentsConfig>;
      return {
        provider: value.provider === "payme" ? "payme" : "demo",
        payme: {
          merchant_id: value.payme?.merchant_id ?? "",
          key: value.payme?.key ?? "",
          test_mode: value.payme?.test_mode ?? true,
        },
      };
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["admin", "payme-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payme_transactions")
        .select("*")
        .order("create_time", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const config = draft ?? stored ?? EMPTY;
  const live =
    config.provider === "payme" && config.payme.merchant_id !== "" && config.payme.key !== "";

  const save = async () => {
    if (config.provider === "payme" && (!config.payme.merchant_id || !config.payme.key)) {
      toast.error("Payme uchun merchant id va kalit ikkalasi ham kerak.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "payments", value: config as never, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft(null);
    toast.success(
      config.provider === "payme"
        ? "Payme yoqildi — checkout endi haqiqiy to'lovga o'tadi"
        : "Demo rejimga qaytarildi",
    );
    void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    void queryClient.invalidateQueries({ queryKey: ["payment_config"] });
  };

  const endpoint =
    typeof window !== "undefined" ? `${window.location.origin}/api/payme` : "/api/payme";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Sozlamalar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          To'lov tizimi va xabarnomalar. Do'kon haqiqiy provayder ulanmaguncha to'lovni simulyatsiya
          qiladi.
        </p>
      </div>

      {/* ---------- CURRENT MODE ---------- */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-3xl border p-5",
          live ? "border-primary/40 bg-accent" : "border-amber-300 bg-amber-50",
        )}
      >
        {live ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        )}
        <div>
          <p className="font-medium">{live ? "Haqiqiy to'lov yoqilgan (Payme)" : "Demo rejim"}</p>
          <p className="text-sm text-muted-foreground">
            {live
              ? config.payme.test_mode
                ? "Payme test muhitida — haqiqiy pul yechilmaydi."
                : "Ishlab chiqarish rejimi — mijozlardan haqiqiy pul yechiladi."
              : "Karta to'lovi simulyatsiya qilinadi. Naqd to'lov esa hozir ham haqiqiy ishlaydi."}
          </p>
        </div>
      </div>

      {/* ---------- PROVIDER ---------- */}
      <div className="space-y-5 rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <CreditCard className="h-5 w-5 text-primary" /> Provider
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["demo", "Demo", "Karta to'lovi simulyatsiya qilinadi"],
              ["payme", "Payme", "Haqiqiy karta to'lovi"],
            ] as const
          ).map(([value, title, body]) => (
            <button
              key={value}
              type="button"
              aria-pressed={config.provider === value}
              onClick={() => setDraft({ ...config, provider: value })}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                config.provider === value
                  ? "border-primary bg-accent shadow-soft"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="block font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{body}</span>
            </button>
          ))}
        </div>

        {config.provider === "payme" ? (
          <div className="space-y-4 rounded-2xl border bg-background p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Merchant ID (Kassa ID)</Label>
                <Input
                  value={config.payme.merchant_id}
                  maxLength={64}
                  placeholder="5e730e8e0b852a417aa49ceb"
                  onChange={(e) =>
                    setDraft({
                      ...config,
                      payme: { ...config.payme, merchant_id: e.target.value.trim() },
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kalit (Key)</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  value={config.payme.key}
                  maxLength={128}
                  placeholder="••••••••••••"
                  onChange={(e) =>
                    setDraft({ ...config, payme: { ...config.payme, key: e.target.value.trim() } })
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={config.payme.test_mode}
                onCheckedChange={(v) =>
                  setDraft({ ...config, payme: { ...config.payme, test_mode: v } })
                }
              />
              Test muhiti (haqiqiy pul yechilmaydi)
            </label>

            <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
              <p className="font-medium">Payme kabinetiga kiritiladigan manzil:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-background px-2 py-1 text-xs">
                  {endpoint}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Nusxalash"
                  onClick={() => {
                    void navigator.clipboard.writeText(endpoint);
                    toast.success("Nusxalandi");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Payme kabinetida &quot;Endpoint URL&quot; maydoniga shuni qo&apos;ying. Buyurtma
                identifikatori maydonini <code>order_id</code> deb nomlang — biz buyurtma raqamini
                (YSM-…) shu nom bilan kutamiz.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex gap-3">
          <Button variant="hero" disabled={saving} onClick={save}>
            Saqlash
          </Button>
          {draft ? (
            <Button variant="soft" onClick={() => setDraft(null)}>
              Bekor qilish
            </Button>
          ) : null}
        </div>
      </div>

      <TelegramSettings />

      <SocialSettings />

      {/* ---------- TRANSACTIONS ---------- */}
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-display text-xl">Payme tranzaksiyalari</h2>
        {(transactions ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Hali tranzaksiya yo&apos;q.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-3">Tranzaksiya</th>
                  <th className="pb-3">Summa</th>
                  <th className="pb-3">Holat</th>
                  <th className="pb-3">Sana</th>
                </tr>
              </thead>
              <tbody>
                {(transactions ?? []).map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-3 font-mono text-xs">{t.id.slice(0, 16)}…</td>
                    <td className="py-3">{formatPrice(Number(t.amount) / 100)}</td>
                    <td className="py-3">
                      {t.state === 2 ? "To'landi" : t.state === 1 ? "Kutilmoqda" : "Bekor qilindi"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(Number(t.create_time)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
