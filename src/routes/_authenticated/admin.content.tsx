import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/content")({
  component: AdminContent,
});

type Row = { key: string; value: unknown };

function AdminContent() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [translations, setTranslations] = useState<
    { key: string; en: string; ru: string; uz: string }[]
  >([]);

  const { data: content } = useQuery({
    queryKey: ["admin", "content"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.from("site_content").select("key,value").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: strings } = useQuery({
    queryKey: ["admin", "translations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("translations").select("*").order("key");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (content) {
      setDrafts(
        Object.fromEntries(content.map((r) => [r.key, JSON.stringify(r.value, null, 2)])),
      );
    }
  }, [content]);

  useEffect(() => {
    if (strings) {
      setTranslations(strings.map((s) => ({ key: s.key, en: s.en, ru: s.ru, uz: s.uz })));
    }
  }, [strings]);

  const saveBlock = async (key: string) => {
    const raw = drafts[key] ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      toast.error("This block isn't valid JSON yet.");
      return;
    }
    const { error } = await supabase
      .from("site_content")
      .update({ value: parsed as never })
      .eq("key", key);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${key} saved`);
    void queryClient.invalidateQueries();
  };

  const saveTranslation = async (row: { key: string; en: string; ru: string; uz: string }) => {
    const { error } = await supabase
      .from("translations")
      .update({ en: row.en, ru: row.ru, uz: row.uz })
      .eq("key", row.key);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${row.key} saved`);
    void queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit landing page blocks and interface translations. Changes go live immediately.
        </p>
      </div>

      <div className="space-y-4">
        {(content ?? []).map((row) => (
          <div key={row.key} className="space-y-3 rounded-3xl border bg-card p-6 shadow-soft">
            <Label className="font-display text-lg capitalize">{row.key}</Label>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={drafts[row.key] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [row.key]: e.target.value }))}
            />
            <Button variant="hero" size="sm" onClick={() => saveBlock(row.key)}>
              Save block
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="font-display text-xl">Interface translations</h2>
        <div className="mt-4 space-y-3">
          {translations.map((row, index) => (
            <div key={row.key} className="grid gap-3 border-t pt-3 sm:grid-cols-[12rem_1fr_1fr_1fr_auto]">
              <p className="self-center font-mono text-xs text-muted-foreground">{row.key}</p>
              {(["en", "ru", "uz"] as const).map((lang) => (
                <Input
                  key={lang}
                  value={row[lang]}
                  maxLength={300}
                  onChange={(e) =>
                    setTranslations((list) =>
                      list.map((r, i) => (i === index ? { ...r, [lang]: e.target.value } : r)),
                    )
                  }
                />
              ))}
              <Button variant="soft" size="sm" onClick={() => saveTranslation(row)}>
                Save
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
