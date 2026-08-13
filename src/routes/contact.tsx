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

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Yesmine — atelier & studio" },
      {
        name: "description",
        content:
          "Reach the Yesmine atelier for styling appointments, sizing advice, order help or wholesale enquiries. Studio address, phone and email.",
      },
      { property: "og:title", content: "Contact Yesmine — atelier & studio" },
      {
        property: "og:description",
        content: "Styling appointments, sizing advice and order support from the Yesmine atelier.",
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

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setForm({ name: "", email: "", message: "" });
    toast.success("Thank you — the atelier will reply within one business day.");
  };

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-soft-gradient" />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal className="max-w-2xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Say hello</p>
          <h1 className="font-display text-4xl sm:text-5xl">Contact the atelier</h1>
          <p className="text-lg text-muted-foreground">
            Styling appointments, sizing advice, order questions or wholesale — we read every message.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <Reveal className="space-y-5 rounded-3xl border bg-card p-7 shadow-soft">
            <div className="space-y-1.5">
              <Label>Your name</Label>
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
              {errors["email"] ? <p className="text-xs text-destructive">{errors["email"]}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                rows={5}
                value={form.message}
                maxLength={1000}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
              {errors["message"] ? <p className="text-xs text-destructive">{errors["message"]}</p> : null}
            </div>
            <Button variant="hero" size="lg" onClick={submit}>
              <Send className="mr-1.5 h-4 w-4" /> Send message
            </Button>
          </Reveal>

          <Reveal delay={120} className="space-y-6">
            <div className="grid gap-4 rounded-3xl border bg-card p-7 shadow-soft">
              <p className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-primary" /> 14 Amir Temur Ave, Tashkent
              </p>
              <p className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-primary" /> +998 71 200 40 40
              </p>
              <p className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-primary" /> hello@yesmine.store
              </p>
              <p className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-primary" /> Mon–Sat, 10:00 – 20:00
              </p>
            </div>
            <MapPicker lat={41.3111} lng={69.2797} onChange={() => {}} className="h-72" />
          </Reveal>
        </div>
      </div>
    </div>
  );
}
