import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { MapPicker } from "@/components/MapPicker";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice, itemKey, useCart } from "@/lib/cart";
import {
  DEMO_DECLINE_CARD,
  DEMO_SUCCESS_CARD,
  formatCardNumber,
  formatExpiry,
  paymeCheckoutUrl,
  placeOrder,
  placeOrderViaPayme,
  processDemoPayment,
  type PaymentMethod,
  type PlacedOrder,
} from "@/lib/checkout";
import { imageSrc, THUMB_WIDTHS, imageSrcSet } from "@/lib/images";
import { useI18n } from "@/lib/i18n";
import { paymentConfigQuery, shippingFor, shopSettingsQuery } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Buyurtmani rasmiylashtirish — Yesmine" },
      {
        name: "description",
        content: "Buyurtmani yakunlang: yetkazib berish ma'lumotlari, xaritadagi manzil va to'lov.",
      },
      { property: "og:title", content: "Buyurtmani rasmiylashtirish — Yesmine" },
      { property: "og:description", content: "Buyurtmangizni xavfsiz yakunlang." },
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

function CheckoutPage() {
  const { t } = useI18n();
  const { items, subtotal, clear } = useCart();
  const queryClient = useQueryClient();

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
  const [stage, setStage] = useState<"idle" | "authorising" | "placing">("idle");
  const [declined, setDeclined] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  // Cash on delivery is the default here, because it's what most shoppers use.
  const [method, setMethod] = useState<PaymentMethod>("cod");

  const { data: settings } = useQuery(shopSettingsQuery);
  const { data: payment } = useQuery(paymentConfigQuery);
  const submitting = stage !== "idle";
  const shipping = settings ? shippingFor(subtotal, settings) : 0;
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
            Order <span className="font-medium text-foreground">{placed.order_number}</span> ·{" "}
            {formatPrice(placed.total)}
          </p>
          <dl className="mx-auto mt-6 max-w-xs space-y-1.5 rounded-2xl border bg-card p-5 text-left text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("cart.subtotal")}</dt>
              <dd>{formatPrice(placed.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("cart.shipping")}</dt>
              <dd>{placed.shipping === 0 ? t("cart.free") : formatPrice(placed.shipping)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-medium">
              <dt>{t("checkout.totalPaid")}</dt>
              <dd>{formatPrice(placed.total)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            {placed.payment_method === "cod" ? t("checkout.codConfirm") : t("checkout.nextSteps")}
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
    setDeclined(null);
    let cardLast4 = "";

    // A configured gateway replaces the simulation entirely: the order is
    // created unpaid and Payme decides, on its own callback, when it is paid.
    if (method === "card" && payment?.live && payment.merchant_id) {
      setStage("placing");
      try {
        const order = await placeOrderViaPayme({ details, coords, items });
        clear();
        window.location.href = paymeCheckoutUrl({
          merchantId: payment.merchant_id,
          orderNumber: order.order_number,
          totalSom: order.total,
          returnUrl: `${window.location.origin}/track`,
        });
        return;
      } catch (e) {
        const message = e instanceof Error ? e.message : "We couldn't place the order.";
        setStage("idle");
        setDeclined(message);
        toast.error(message);
        return;
      }
    }

    // Cash orders skip authorisation entirely — the courier collects on arrival.
    if (method === "card") {
      const parsed = cardSchema.safeParse({ ...card, number: card.number.replace(/\s/g, "") });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues)
          next[`card_${String(issue.path[0])}`] = issue.message;
        setErrors(next);
        return;
      }
      setErrors({});

      setStage("authorising");
      const authorised = await processDemoPayment({
        number: parsed.data.number,
        expiry: parsed.data.expiry,
      });
      if (!authorised.ok) {
        setStage("idle");
        setDeclined(authorised.message);
        toast.error(authorised.message);
        return;
      }
      cardLast4 = authorised.last4;
    } else {
      setErrors({});
    }

    // Let the database price the basket, reserve stock and number the order.
    setStage("placing");
    try {
      const order = await placeOrder({
        details,
        coords,
        cardLast4,
        items,
        paymentMethod: method,
      });
      setPlaced(order);
      clear();
      // Stock moved — refresh anything showing product availability.
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["product"] });
    } catch (e) {
      const message = e instanceof Error ? e.message : "We couldn't place the order.";
      console.error(e);
      setDeclined(message);
      toast.error(message);
    } finally {
      setStage("idle");
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
                <Field label={t("checkout.note")} error={errors["note"]}>
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
                  {t("checkout.toDelivery")}
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
                  {t("checkout.pinnedAt")} {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
                <div className="flex gap-3">
                  <Button variant="soft" onClick={() => setStep("customer")}>
                    Back
                  </Button>
                  <Button variant="hero" size="lg" onClick={() => setStep("payment")}>
                    {t("checkout.toPayment")}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === "payment" ? (
              <div className="space-y-5">
                <h2 className="flex items-center gap-2 font-display text-2xl">
                  <CreditCard className="h-5 w-5 text-primary" /> {t("checkout.payment")}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MethodCard
                    active={method === "cod"}
                    icon={Banknote}
                    title={t("checkout.methodCod")}
                    body={t("checkout.codNote")}
                    onClick={() => setMethod("cod")}
                  />
                  <MethodCard
                    active={method === "card"}
                    icon={CreditCard}
                    title={payment?.live ? t("checkout.methodPayme") : t("checkout.methodCard")}
                    body={payment?.live ? t("checkout.paymeNote") : t("checkout.demoNote")}
                    onClick={() => setMethod("card")}
                  />
                </div>

                {declined ? (
                  <p className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {declined}
                  </p>
                ) : null}

                {method === "card" && !payment?.live ? (
                  <>
                    <div className="space-y-1.5 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
                      <p className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> {t("checkout.demoNote")}
                      </p>
                      <p className="text-accent-foreground/80">
                        {t("checkout.approved")}:{" "}
                        <span className="font-mono">{DEMO_SUCCESS_CARD}</span> ·{" "}
                        {t("checkout.declined")}:{" "}
                        <span className="font-mono">{DEMO_DECLINE_CARD}</span>
                      </p>
                    </div>

                    <Field label={t("checkout.cardNumber")} error={errors["card_number"]}>
                      <Input
                        inputMode="numeric"
                        autoComplete="cc-number"
                        value={formatCardNumber(card.number)}
                        maxLength={19}
                        placeholder={DEMO_SUCCESS_CARD}
                        onChange={(e) =>
                          setCard((c) => ({
                            ...c,
                            number: e.target.value.replace(/\D/g, "").slice(0, 16),
                          }))
                        }
                      />
                    </Field>
                    <Field label={t("checkout.cardName")} error={errors["card_name"]}>
                      <Input
                        value={card.name}
                        maxLength={100}
                        autoComplete="cc-name"
                        onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                      />
                    </Field>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label={t("checkout.expiry")} error={errors["card_expiry"]}>
                        <Input
                          value={card.expiry}
                          inputMode="numeric"
                          maxLength={5}
                          autoComplete="cc-exp"
                          placeholder="04/28"
                          onChange={(e) =>
                            setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))
                          }
                        />
                      </Field>
                      <Field label={t("checkout.cvc")} error={errors["card_cvc"]}>
                        <Input
                          inputMode="numeric"
                          value={card.cvc}
                          maxLength={4}
                          autoComplete="cc-csc"
                          placeholder="123"
                          onChange={(e) =>
                            setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, "") }))
                          }
                        />
                      </Field>
                    </div>
                  </>
                ) : null}
                <div className="flex gap-3">
                  <Button variant="soft" disabled={submitting} onClick={() => setStep("delivery")}>
                    {t("common.back")}
                  </Button>
                  <Button variant="hero" size="xl" disabled={submitting} onClick={submitOrder}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {stage === "authorising"
                      ? t("checkout.authorising")
                      : stage === "placing"
                        ? t("checkout.placing")
                        : `${method === "cod" ? t("checkout.placeOrder") : t("checkout.pay")} · ${formatPrice(total)}`}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="h-fit space-y-4 rounded-3xl border bg-card p-6 shadow-soft lg:sticky lg:top-24">
            <h2 className="font-display text-2xl">{t("checkout.order")}</h2>
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={itemKey(i)} className="flex gap-3">
                  <img
                    src={imageSrc(i.image, 160)}
                    srcSet={imageSrcSet(i.image, THUMB_WIDTHS)}
                    sizes="48px"
                    loading="lazy"
                    decoding="async"
                    alt={i.name}
                    className="h-16 w-12 rounded-lg object-cover"
                  />
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
                <span className="text-muted-foreground">{t("cart.shipping")}</span>
                <span>{shipping === 0 ? t("cart.free") : formatPrice(shipping)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="font-medium">{t("cart.total")}</span>
                <span className="font-display text-2xl text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** One choice in the payment method picker. */
function MethodCard({
  active,
  icon: Icon,
  title,
  body,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
        active ? "border-primary bg-accent shadow-soft" : "border-border hover:border-primary/40",
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 text-primary" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
    </button>
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
