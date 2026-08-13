import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, Loader2, MapPin, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { MapPicker } from "@/components/MapPicker";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, itemKey, useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Yesmine" },
      { name: "description", content: "Complete your Yesmine order: delivery details, map pin and demo payment." },
      { property: "og:title", content: "Checkout — Yesmine" },
      { property: "og:description", content: "Complete your Yesmine order securely." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const detailsSchema = z.object({
  customer_name: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(30),
  email: z.string().trim().email("Enter a valid email").max(255).or(z.literal("")),
  address: z.string().trim().min(6, "Enter a delivery address").max(300),
  note: z.string().trim().max(500),
});

const cardSchema = z.object({
  number: z.string().regex(/^\d{16}$/, "Card number must be 16 digits"),
  name: z.string().trim().min(2, "Name on card is required").max(100),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY"),
  cvc: z.string().regex(/^\d{3,4}$/, "CVC must be 3-4 digits"),
});

const STEPS = ["customer", "delivery", "payment", "confirm"] as const;
type Step = (typeof STEPS)[number];

function orderNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `YSM-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function CheckoutPage() {
  const { t } = useI18n();
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("customer");
  const [details, setDetails] = useState({
    customer_name: "",
    phone: "",
    email: "",
    address: "",
    note: "",
  });
  const [coords, setCoords] = useState({ lat: 41.3111, lng: 69.2797 });
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{ number: string; total: number } | null>(null);

  const shipping = subtotal > 200 || subtotal === 0 ? 0 : 15;
  const total = subtotal + shipping;

  if (!placed && items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <h1 className="font-display text-3xl">{t("cart.empty")}</h1>
        <Button variant="hero" size="lg" className="mt-6" asChild>
          <Link to="/shop">{t("nav.shop")}</Link>
        </Button>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <Reveal>
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-6 font-display text-4xl">{t("checkout.thanks")}</h1>
          <p className="mt-3 text-muted-foreground">
            Order <span className="font-medium text-foreground">{placed.number}</span> ·{" "}
            {formatPrice(placed.total)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            We'll call you shortly to confirm delivery to your pinned location.
          </p>
          <Button variant="hero" size="lg" className="mt-8" asChild>
            <Link to="/shop">{t("nav.shop")}</Link>
          </Button>
        </Reveal>
      </div>
    );
  }

  const validateDetails = () => {
    const parsed = detailsSchema.safeParse(details);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return false;
    }
    setErrors({});
    return true;
  };

  const submitOrder = async () => {
    const parsed = cardSchema.safeParse({ ...card, number: card.number.replace(/\s/g, "") });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[`card_${String(issue.path[0])}`] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const number = orderNumber();
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          order_number: number,
          customer_name: details.customer_name.trim(),
          phone: details.phone.trim(),
          email: details.email.trim() || null,
          address: details.address.trim(),
          note: details.note.trim() || null,
          lat: coords.lat,
          lng: coords.lng,
          subtotal,
          shipping,
          total,
          status: "pending",
          payment_status: "paid",
          payment_ref: `DEMO-${parsed.data.number.slice(-4)}`,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.productId,
          product_name: i.name,
          price: i.price,
          quantity: i.quantity,
          size: i.size,
          color: i.color,
          image_url: i.image,
        })),
      );
      if (itemsError) throw itemsError;

      setPlaced({ number, total });
      clear();
      void navigate;
    } catch (e) {
      console.error(e);
      toast.error("We couldn't place the order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-soft-gradient" />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal className="mb-8">
          <h1 className="font-display text-4xl sm:text-5xl">{t("common.checkout")}</h1>
        </Reveal>

        <ol className="mb-10 flex flex-wrap items-center gap-3 text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  i <= stepIndex
                    ? "border-transparent bg-brand-gradient text-on-brand"
                    : "border-border text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className={cn(i === stepIndex ? "text-foreground" : "text-muted-foreground")}>
                {t(`checkout.${s === "confirm" ? "confirm" : s}`)}
              </span>
              {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
            </li>
          ))}
        </ol>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6 rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
            {step === "customer" ? (
              <div className="space-y-5">
                <h2 className="flex items-center gap-2 font-display text-2xl">
                  <User className="h-5 w-5 text-primary" /> {t("checkout.customer")}
                </h2>
                <Field label={t("checkout.name")} error={errors["customer_name"]}>
                  <Input
                    value={details.customer_name}
                    maxLength={100}
                    onChange={(e) => setDetails((d) => ({ ...d, customer_name: e.target.value }))}
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t("checkout.phone")} error={errors["phone"]}>
                    <Input
                      value={details.phone}
                      maxLength={30}
                      onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
                    />
                  </Field>
                  <Field label={t("checkout.email")} error={errors["email"]}>
                    <Input
                      type="email"
                      value={details.email}
                      maxLength={255}
                      onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))}
                    />
                  </Field>
                </div>
                <Field label={t("checkout.address")} error={errors["address"]}>
                  <Input
                    value={details.address}
                    maxLength={300}
                    onChange={(e) => setDetails((d) => ({ ...d, address: e.target.value }))}
                  />
                </Field>
                <Field label="Order note (optional)" error={errors["note"]}>
                  <Textarea
                    value={details.note}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => setDetails((d) => ({ ...d, note: e.target.value }))}
                  />
                </Field>
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => {
                    if (validateDetails()) setStep("delivery");
                  }}
                >
                  Continue to delivery
                </Button>
              </div>
            ) : null}

            {step === "delivery" ? (
              <div className="space-y-5">
                <h2 className="flex items-center gap-2 font-display text-2xl">
                  <MapPin className="h-5 w-5 text-primary" /> {t("checkout.delivery")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("checkout.pin")}</p>
                <MapPicker lat={coords.lat} lng={coords.lng} onChange={setCoords} />
                <p className="text-sm text-muted-foreground">
                  Pinned at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
                <div className="flex gap-3">
                  <Button variant="soft" onClick={() => setStep("customer")}>
                    Back
                  </Button>
                  <Button variant="hero" size="lg" onClick={() => setStep("payment")}>
                    Continue to payment
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "payment" ? (
              <div className="space-y-5">
                <h2 className="flex items-center gap-2 font-display text-2xl">
                  <CreditCard className="h-5 w-5 text-primary" /> {t("checkout.payment")}
                </h2>
                <p className="flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
                  <ShieldCheck className="h-4 w-4" /> Demo payment — no real card is charged. Try 4242
                  4242 4242 4242.
                </p>
                <Field label="Card number" error={errors["card_number"]}>
                  <Input
                    inputMode="numeric"
                    value={card.number}
                    maxLength={19}
                    placeholder="4242 4242 4242 4242"
                    onChange={(e) =>
                      setCard((c) => ({ ...c, number: e.target.value.replace(/[^\d]/g, "").slice(0, 16) }))
                    }
                  />
                </Field>
                <Field label="Name on card" error={errors["card_name"]}>
                  <Input
                    value={card.name}
                    maxLength={100}
                    onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Expiry (MM/YY)" error={errors["card_expiry"]}>
                    <Input
                      value={card.expiry}
                      maxLength={5}
                      placeholder="04/28"
                      onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
                    />
                  </Field>
                  <Field label="CVC" error={errors["card_cvc"]}>
                    <Input
                      inputMode="numeric"
                      value={card.cvc}
                      maxLength={4}
                      placeholder="123"
                      onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, "") }))}
                    />
                  </Field>
                </div>
                <div className="flex gap-3">
                  <Button variant="soft" onClick={() => setStep("delivery")}>
                    Back
                  </Button>
                  <Button variant="hero" size="xl" disabled={submitting} onClick={submitOrder}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t("checkout.pay")} · {formatPrice(total)}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="h-fit space-y-4 rounded-3xl border bg-card p-6 shadow-soft lg:sticky lg:top-24">
            <h2 className="font-display text-2xl">Order</h2>
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={itemKey(i)} className="flex gap-3">
                  <img src={i.image ?? ""} alt={i.name} className="h-16 w-12 rounded-lg object-cover" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-muted-foreground">
                      ×{i.quantity} {[i.size, i.color].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-sm">{formatPrice(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="font-medium">Total</span>
                <span className="font-display text-2xl text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
