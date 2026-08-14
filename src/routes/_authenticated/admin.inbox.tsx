import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, Mail, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/inbox")({
  component: AdminInbox,
});

function AdminInbox() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"messages" | "subscribers">("messages");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin", "messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: subscribers } = useQuery({
    queryKey: ["admin", "subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = (key: string) => void queryClient.invalidateQueries({ queryKey: ["admin", key] });

  const markHandled = async (id: string, handled: boolean) => {
    const { error } = await supabase.from("contact_messages").update({ handled }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh("messages");
  };

  const removeMessage = async (id: string) => {
    if (!window.confirm("Delete this message?")) return;
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Message deleted");
    refresh("messages");
  };

  /** Hands the owner a file they can paste straight into a mailing tool. */
  const exportSubscribers = () => {
    const rows = (subscribers ?? []).filter((s) => s.active).map((s) => s.email);
    if (rows.length === 0) {
      toast.error("No active subscribers yet.");
      return;
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "yesmine-subscribers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const unread = (messages ?? []).filter((m) => !m.handled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Messages from the contact form and everyone who joined the newsletter.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "messages" ? "hero" : "soft"} onClick={() => setTab("messages")}>
          <Mail className="mr-1.5 h-4 w-4" /> Messages
          {unread > 0 ? (
            <span className="ml-2 rounded-full bg-on-brand/20 px-2 text-xs">{unread}</span>
          ) : null}
        </Button>
        <Button
          variant={tab === "subscribers" ? "hero" : "soft"}
          onClick={() => setTab("subscribers")}
        >
          <Users className="mr-1.5 h-4 w-4" /> Subscribers ({subscribers?.length ?? 0})
        </Button>
      </div>

      {tab === "messages" ? (
        isLoading ? (
          <div className="h-40 animate-pulse rounded-3xl bg-muted" />
        ) : (messages ?? []).length === 0 ? (
          <div className="rounded-3xl border bg-card p-12 text-center text-muted-foreground">
            No messages yet.
          </div>
        ) : (
          <div className="space-y-3">
            {(messages ?? []).map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-3xl border bg-card p-5 shadow-soft",
                  m.handled && "opacity-60",
                )}
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-medium">{m.name}</span>
                  <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline">
                    {m.email}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={m.handled ? "Mark unhandled" : "Mark handled"}
                      onClick={() => markHandled(m.id, !m.handled)}
                    >
                      <Check className={cn("h-4 w-4", m.handled && "text-primary")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete message"
                      onClick={() => removeMessage(m.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {m.message}
                </p>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {(subscribers ?? []).filter((s) => s.active).length} active subscribers
            </p>
            <Button variant="soft" size="sm" onClick={exportSubscribers}>
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <ul className="divide-y rounded-2xl border">
            {(subscribers ?? []).map((s) => (
              <li key={s.email} className="flex items-center gap-3 p-3 text-sm">
                <span className={cn(!s.active && "text-muted-foreground line-through")}>
                  {s.email}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
            {(subscribers ?? []).length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">Nobody has subscribed yet.</li>
            ) : null}
          </ul>
        </div>
      )}
    </div>
  );
}
