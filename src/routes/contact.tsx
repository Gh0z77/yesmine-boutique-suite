import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";

import { useI18n } from "@/lib/i18n";
import { contentQuery } from "@/lib/store";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Aloqa — Yesmine atelyesi" },
      {
        name: "description",
        content:
          "Reach the Yesmine atelier for styling appointments, sizing advice, order help or wholesale enquiries. Studio address, phone and email.",
      },
      { property: "og:title", content: "Aloqa — Yesmine atelyesi" },
      {
        property: "og:description",
        content: "Yesmine atelyesidan uslub, o'lcham va buyurtma bo'yicha yordam.",
      },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  message: z.string().trim().min(10, "Tell us a little more").max(1000),
});

/** Falls back to the Tashkent studio until the block is filled in. */
const STUDIO_FALLBACK = { lat: 41.3111, lng: 69.2797 };

type ContactBlock = {
  phone?: string;
  email?: string;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
};

function ContactPage() {
  const { t, lang } = useI18n();
  const { data: content } = useQuery(contentQuery);
  // Address, phone and hours are owner-editable, so the page reads them
  // instead of carrying its own copy.
  const info = ((content?.["contact"] ?? {}) as ContactBlock) ?? {};
  const line = (base: string) =>
    (info[`${base}_${lang}`] as string) || (info[`${base}_uz`] as string) || "";
  const STUDIO = {
    lat: Number(info.lat) || STUDIO_FALLBACK.lat,
    lng: Number(info.lng) || STUDIO_FALLBACK.lng,
  };
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [view, setView] = useState(STUDIO);

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSending(true);
    const { error } = await supabase.rpc("submit_contact_message", {
      p_name: parsed.data.name,
      p_email: parsed.data.email,
      p_message: parsed.data.message,
    });
    setSending(false);
    if (error) {
      toast.error(
        error.message.includes("TOO_MANY_MESSAGES")
          ? "You've already sent us a few messages — we'll reply shortly."
          : "We couldn't send that. Please try again.",
      );
      return;
    }
    setForm({ name: "", email: "", message: "" });
    toast.success(t("contact.sent"));
  };

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-soft-gradient" />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal className="max-w-2xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("contact.eyebrow")}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">{t("contact.title")}</h1>
          <p className="text-lg text-muted-foreground">{t("contact.body")}</p>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <Reveal className="space-y-5 rounded-3xl border bg-card p-7 shadow-soft">
            <div className="space-y-1.5">
              <Label>{t("contact.name")}</Label>
              <Input
                value={form.name}
                maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {errors["name"] ? <p className="text-xs text-destructive">{errors["name"]}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              {errors["email"] ? (
                <p className="text-xs text-destructive">{errors["email"]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>{t("contact.message")}</Label>
              <Textarea
                rows={5}
                value={form.message}
                maxLength={1000}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
              {errors["message"] ? (
                <p className="text-xs text-destructive">{errors["message"]}</p>
              ) : null}
            </div>
            <Button variant="hero" size="lg" disabled={sending} onClick={submit}>
              <Send className="mr-1.5 h-4 w-4" /> {t("contact.send")}
            </Button>
          </Reveal>

          <Reveal delay={120} className="space-y-6">
            <div className="grid gap-4 rounded-3xl border bg-card p-7 shadow-soft">
              <p className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-primary" /> {line("address")}
              </p>
              <p className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-primary" /> {info.phone}
              </p>
              <p className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-primary" /> {info.email}
              </p>
              <p className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-primary" /> {line("hours")}
              </p>
            </div>
            <div className="space-y-2">
              <MapPicker lat={view.lat} lng={view.lng} onChange={setView} className="h-72" />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <a
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  href={`https://www.openstreetmap.org/?mlat=${STUDIO.lat}&mlon=${STUDIO.lng}#map=17/${STUDIO.lat}/${STUDIO.lng}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <MapPin className="h-3.5 w-3.5" /> {t("contact.openMaps")}
                </a>
                {view.lat !== STUDIO.lat || view.lng !== STUDIO.lng ? (
                  <button
                    type="button"
                    onClick={() => setView(STUDIO)}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t("contact.recentre")}
                  </button>
                ) : null}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
