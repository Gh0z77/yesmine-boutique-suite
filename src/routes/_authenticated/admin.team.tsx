import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/team")({
  component: AdminTeam,
});

type Member = { id: string; email: string; joined_at: string; roles: string[] };
/** Maps the database's sentinel errors to something a store owner understands. */
function friendly(message: string): string {
  if (message.includes("LAST_ADMIN"))
    return "This is the only admin left — promote someone else first.";
  if (message.includes("NO_SUCH_USER"))
    return "Nobody has signed up with that email yet. Add them to the allow list, then ask them to create their account.";
  if (message.includes("ADMIN_EXISTS"))
    return "Do'konda faqat bitta admin bo'ladi. Yangi odamga huquq berish uchun uni Xodimlar bo'limidan lavozim bilan qo'shing.";
  if (message.includes("NOT_ADMIN")) return "Only admins can change roles.";
  return message;
}

function AdminTeam() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.rpc("list_team");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const { data: allowlist } = useQuery({
    queryKey: ["admin", "allowlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_allowlist")
        .select("email,note,created_at")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "team"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "allowlist"] });
  };

  const toggleRole = async (email: string, role: "admin" | "staff", enabled: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_user_role", {
      p_email: email,
      p_role: role,
      p_enabled: enabled,
    });
    setBusy(false);
    if (error) {
      toast.error(friendly(error.message));
      return;
    }
    toast.success(enabled ? `${email} is now ${role}` : `${role} removed from ${email}`);
    refresh();
  };

  const addToAllowlist = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("admin_allowlist")
      .insert({ email, note: inviteNote.trim() || null });
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? "That email is already on the list." : error.message);
      return;
    }
    setInviteEmail("");
    setInviteNote("");
    toast.success(`${email} can now create a studio account`);
    refresh();
  };

  const removeFromAllowlist = async (email: string) => {
    if (
      !window.confirm(
        `Remove ${email} from the allow list?\n\nThey keep any account they already created — remove their roles below to revoke access.`,
      )
    )
      return;
    const { error } = await supabase.from("admin_allowlist").delete().eq("email", email);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed from the allow list");
    refresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Studio access is closed. Only the emails below can create an account, and only admins can
          change what anyone sees.
        </p>
      </div>

      {/* ---------- WHO CAN SIGN UP ---------- */}
      <section className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" /> Allowed to sign up
          </h2>
          <p className="text-sm text-muted-foreground">
            Anyone not on this list is rejected at sign-up — they never reach a login screen.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              value={inviteEmail}
              maxLength={255}
              placeholder="name@example.com"
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Input
              value={inviteNote}
              maxLength={120}
              placeholder="Shop manager"
              onChange={(e) => setInviteNote(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="hero" disabled={busy} onClick={addToAllowlist}>
              <Plus className="mr-1.5 h-4 w-4" /> Allow
            </Button>
          </div>
        </div>

        <ul className="divide-y rounded-2xl border">
          {(allowlist ?? []).map((row) => (
            <li key={row.email} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="font-medium">{row.email}</span>
              {row.note ? <span className="text-muted-foreground">· {row.note}</span> : null}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label={`Remove ${row.email}`}
                onClick={() => removeFromAllowlist(row.email)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
          {(allowlist ?? []).length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">
              The list is empty — nobody can create a studio account.
            </li>
          ) : null}
        </ul>
      </section>

      {/* ---------- ROLES ---------- */}
      <section className="space-y-4 rounded-3xl border bg-card p-6 shadow-soft">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl">
            <UserCog className="h-5 w-5 text-primary" /> Accounts and roles
          </h2>
          <p className="text-sm text-muted-foreground">
            Admins see and change everything. Staff can sign in but see nothing until you grant them
            admin.
          </p>
        </div>

        {isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-3">Account</th>
                  <th className="pb-3">Joined</th>
                  <th className="pb-3">Admin</th>
                  <th className="pb-3">Staff</th>
                </tr>
              </thead>
              <tbody>
                {(members ?? []).map((m) => {
                  const isAdmin = m.roles.includes("admin");
                  const isStaff = m.roles.includes("staff");
                  const isSelf = m.id === session?.id;
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="py-3">
                        <span className="font-medium">{m.email}</span>
                        {isSelf ? (
                          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                            you
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        {/* The shop keeps exactly one admin for its lifetime, so
                            this can never be toggled either way — showing it as
                            a live switch only produced database errors. */}
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs",
                            isAdmin
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isAdmin ? "Admin" : "—"}
                        </span>
                      </td>
                      <td className="py-3">
                        <Switch
                          checked={isStaff}
                          disabled={busy}
                          aria-label={`Staff role for ${m.email}`}
                          onCheckedChange={(v) => toggleRole(m.email, "staff", v)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Do'konda bitta admin bo'ladi va u o'zgarmaydi — shu sababli studio hech qachon o'zini
          qulflab qo'ymaydi. Xodimlarga huquq lavozim orqali beriladi: Admin → Xodimlar.
        </p>
      </section>
    </div>
  );
}
