import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type SocialConfig = {
  telegram_bot_token: string;
  telegram_channel: string;
  facebook_app_id: string;
  facebook_app_secret: string;
  google_client_id: string;
  google_client_secret: string;
  gemini_api_key: string;
};

const EMPTY: SocialConfig = {
  telegram_bot_token: "",
  telegram_channel: "",
  facebook_app_id: "",
  facebook_app_secret: "",
  google_client_id: "",
  google_client_secret: "",
  gemini_api_key: "",
};

const CALLBACK_BASE = "https://tghtczeyciuqapqegikv.supabase.co/functions/v1";

function Status({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs",
        on ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {on ? "Tayyor" : "Sozlanmagan"}
    </span>
  );
}

/**
 * Keys the marketing panel runs on: publishing and the AI assistant.
 *
 * They sit in app_settings, which only the owner can read — the storefront and
 * the staff panel never see them. Each key switches its own feature on the
 * moment it is filled in, the same way the Payme credentials do.
 */
export function SocialSettings() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SocialConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "social"],
    queryFn: async (): Promise<SocialConfig> => {
      const { data: row, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "social")
        .maybeSingle();
      if (error) throw error;
      return { ...EMPTY, ...((row?.value ?? {}) as Partial<SocialConfig>) };
    },
  });

  const config = draft ?? data ?? EMPTY;
  const set = (patch: Partial<SocialConfig>) => setDraft({ ...config, ...patch });
  const ready = (...values: string[]) => values.every((value) => value.trim().length > 0);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "social", value: config as never, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft(null);
    toast.success("Saqlandi — kalitlar darhol ishlaydi");
    void queryClient.invalidateQueries({ queryKey: ["admin", "social"] });
  };

  return (
    <section className="space-y-5 rounded-3xl border bg-card p-6 shadow-soft">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Share2 className="h-5 w-5 text-primary" /> Ijtimoiy tarmoqlar va AI
        </h2>
        <p className="text-sm text-muted-foreground">
          Marketing paneli shu kalitlar bilan ishlaydi. Bo&apos;sh qolgan qatorning xizmati
          o&apos;chiq turadi — kalit kiritilgan zahoti o&apos;zi yonadi.
        </p>
      </div>

      {/* ---------------- TELEGRAM ---------------- */}
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">Telegram</h3>
          <Status on={ready(config.telegram_bot_token, config.telegram_channel)} />
          <span className="ml-auto text-xs text-muted-foreground">
            Tasdiqlash kerak emas — darhol ishlaydi
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Bot token</Label>
            <Input
              type="password"
              maxLength={200}
              placeholder="@BotFather bergan token"
              value={config.telegram_bot_token}
              onChange={(e) => set({ telegram_bot_token: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kanal</Label>
            <Input
              maxLength={120}
              placeholder="@yesmine_uz"
              value={config.telegram_channel}
              onChange={(e) => set({ telegram_channel: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Botni kanalga administrator qilib qo&apos;shing — aks holda Telegram post qo&apos;yishga
          ruxsat bermaydi.
        </p>
      </div>

      {/* ---------------- META ---------------- */}
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">Instagram / Facebook</h3>
          <Status on={ready(config.facebook_app_id, config.facebook_app_secret)} />
          <span className="ml-auto text-xs text-muted-foreground">developers.facebook.com</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>App ID</Label>
            <Input
              maxLength={64}
              value={config.facebook_app_id}
              onChange={(e) => set({ facebook_app_id: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>App secret</Label>
            <Input
              type="password"
              maxLength={128}
              value={config.facebook_app_secret}
              onChange={(e) => set({ facebook_app_secret: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Meta ilovasidagi <span className="font-medium">Valid OAuth Redirect URI</span> ga:
        </p>
        <code className="block overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
          {CALLBACK_BASE}/instagram-oauth-callback
        </code>
      </div>

      {/* ---------------- GOOGLE ---------------- */}
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">YouTube</h3>
          <Status on={ready(config.google_client_id, config.google_client_secret)} />
          <span className="ml-auto text-xs text-muted-foreground">console.cloud.google.com</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Client ID</Label>
            <Input
              maxLength={200}
              value={config.google_client_id}
              onChange={(e) => set({ google_client_id: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Client secret</Label>
            <Input
              type="password"
              maxLength={200}
              value={config.google_client_secret}
              onChange={(e) => set({ google_client_secret: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Authorized redirect URI:</p>
        <code className="block overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
          {CALLBACK_BASE}/youtube-oauth
        </code>
      </div>

      {/* ---------------- AI ---------------- */}
      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">AI yordamchi</h3>
          <Status on={ready(config.gemini_api_key)} />
          <span className="ml-auto text-xs text-muted-foreground">aistudio.google.com/apikey</span>
        </div>
        <div className="space-y-1.5">
          <Label>Gemini API key</Label>
          <Input
            type="password"
            maxLength={200}
            placeholder="AIza..."
            value={config.gemini_api_key}
            onChange={(e) => set({ gemini_api_key: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Ssenariy, matn, hashtag, tahlil va rasm yaratish shu kalit bilan ishlaydi.
        </p>
      </div>

      <Button variant="hero" disabled={busy} onClick={save}>
        Saqlash
      </Button>
    </section>
  );
}
