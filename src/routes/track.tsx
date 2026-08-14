import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Loader2, PackageSearch, XCircle } from "lucide-react";
import { useState } from "react";

import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Buyurtmani kuzatish — Yesmine" },
      {
        name: "description",
        content: "Buyurtma raqami va telefon orqali buyurtmangiz qayerdaligini bilib oling.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackPage,
});

type Found = {
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  created_at: string;
  items: { product_name: string; quantity: number; size: string | null; color: string | null }[];
};

/** The happy path a parcel walks through; cancelled is handled separately. */
const FLOW = ["pending", "processing", "shipped", "delivered"] as const;

function TrackPage() {
  const { t } = useI18n();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Found | null>(null);
  const [notFound, setNotFound] = useState(false);

  const check = async () => {
    setBusy(true);
    setNotFound(false);
    setResult(null);

    // Anonymous visitors can't read the orders table, so the lookup goes
    // through a function that requires both the number and the phone.
    const { data, error } = await supabase.rpc("track_order", {
      p_order_number: orderNumber.trim().toUpperCase(),
      p_phone: phone.trim(),
    });
    setBusy(false);

    const order = data as unknown as Found | null;
    if (error || !order?.order_number) {
      setNotFound(true);
      return;
    }
    setResult(order);
  };

  const cancelled = result?.status === "cancelled";
  const activeIndex = result ? FLOW.indexOf(result.status as (typeof FLOW)[number]) : -1;

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-soft-gradient" />
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Reveal className="space-y-3 text-center">
          <PackageSearch className="mx-auto h-10 w-10 text-primary" />
          <h1 className="font-display text-4xl sm:text-5xl">{t("track.title")}</h1>
          <p className="text-muted-foreground">{t("track.body")}</p>
        </Reveal>

        <Reveal delay={100} className="mt-10 space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("track.orderNumber")}</Label>
              <Input
                value={orderNumber}
                maxLength={30}
                placeholder="YSM-2608-1001"
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("checkout.phone")}</Label>
              <Input
                value={phone}
                maxLength={30}
                placeholder="+998 90 123 45 67"
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void check();
                }}
              />
            </div>
          </div>
          <Button variant="hero" size="lg" disabled={busy} onClick={check}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("track.check")}
          </Button>
        </Reveal>

        {notFound ? (
          <p className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
            {t("track.notFound")}
          </p>
        ) : null}

        {result ? (
          <Reveal className="mt-8 space-y-6 rounded-3xl border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl">{result.order_number}</h2>
              <span className="font-display text-xl text-primary">
                {formatPrice(Number(result.total))}
              </span>
            </div>

            {cancelled ? (
              <p className="flex items-center gap-2 rounded-2xl bg-muted p-4 text-sm">
                <XCircle className="h-5 w-5 text-destructive" /> {t("status.cancelled")}
              </p>
            ) : (
              <ol className="space-y-3">
                {FLOW.map((status, i) => {
                  const done = i <= activeIndex;
                  return (
                    <li key={status} className="flex items-center gap-3">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                      )}
                      <span
                        className={cn("text-sm", done ? "font-medium" : "text-muted-foreground")}
                      >
                        {t(`status.${status}`)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="space-y-1 border-t pt-4 text-sm text-muted-foreground">
              {result.items.map((i, index) => (
                <p key={index}>
                  {i.product_name} ×{i.quantity} {[i.size, i.color].filter(Boolean).join(" · ")}
                </p>
              ))}
              <p className="pt-2">
                {result.payment_method === "cod"
                  ? t("checkout.methodCod")
                  : t("checkout.methodCard")}{" "}
                · {result.payment_status}
              </p>
              <p>{new Date(result.created_at).toLocaleString()}</p>
            </div>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}
