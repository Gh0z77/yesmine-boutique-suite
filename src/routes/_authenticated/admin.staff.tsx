import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: AdminStaff,
});

type Department = { id: string; code: string; name_uz: string; panel: string; sort_order: number };
type Position = {
  id: string;
  department_id: string;
  code: string;
  title_uz: string;
  headcount: number;
  permissions: string[];
  sort_order: number;
};
type Employee = {
  id: string;
  user_id: string | null;
  position_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  hired_at: string;
};

const BLANK = { full_name: "", phone: "", email: "", position_id: "" };

function AdminStaff() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<typeof BLANK | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase.from("departments").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["admin", "positions"],
    queryFn: async (): Promise<Position[]> => {
      const { data, error } = await supabase.from("positions").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["admin", "employees"],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase.from("employees").select("*").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "employees"] });

  const add = async () => {
    if (!draft) return;
    if (draft.full_name.trim().length < 2) {
      toast.error("Ism-familiyani kiriting.");
      return;
    }
    if (!draft.position_id) {
      toast.error("Lavozimni tanlang.");
      return;
    }
    const email = draft.email.trim().toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      toast.error("Email noto'g'ri.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("employees").insert({
      full_name: draft.full_name.trim(),
      phone: draft.phone.trim() || null,
      email: email || null,
      position_id: draft.position_id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.code === "23505" ? "Bu email allaqachon band." : error.message);
      return;
    }
    setDraft(null);
    toast.success(
      email
        ? "Xodim qo'shildi — endi u shu email bilan ro'yxatdan o'tib, o'z parolini qo'yadi"
        : "Xodim qo'shildi (kirish uchun keyinroq email qo'shing)",
    );
    refresh();
  };

  const toggleActive = async (e: Employee) => {
    const { error } = await supabase.from("employees").update({ active: !e.active }).eq("id", e.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(e.active ? `${e.full_name} — nofaol` : `${e.full_name} — faol`);
    refresh();
  };

  const remove = async (e: Employee) => {
    if (!window.confirm(`"${e.full_name}" o'chirilsinmi?\n\nHisobi bo'lsa, u kira olmay qoladi.`))
      return;
    const { error } = await supabase.from("employees").delete().eq("id", e.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("O'chirildi");
    refresh();
  };

  const inviteText = (e: Employee) =>
    `Salom, ${e.full_name}!\n\nYesmine ish panelingizga kirish uchun:\n1. ${
      typeof window !== "undefined" ? window.location.origin : ""
    }/auth manzilini oching\n2. "Ro'yxatdan o'tish" ni bosing\n3. Email: ${e.email}\n4. O'zingiz xohlagan parolni qo'ying\n\nParolni hech kimga aytmang.`;

  const positionsOf = (departmentId: string) =>
    positions.filter((p) => p.department_id === departmentId);
  const staffOf = (positionId: string) => employees.filter((e) => e.position_id === positionId);

  const withAccount = employees.filter((e) => e.user_id).length;
  const planned = positions.reduce((n, p) => n + p.headcount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Xodimlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {employees.filter((e) => e.active).length} faol xodim · {planned} ta o'rin ·{" "}
            {withAccount} tasida kirish hisobi bor
          </p>
        </div>
        <Button variant="hero" onClick={() => setDraft({ ...BLANK })}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Xodim qo'shish
        </Button>
      </div>

      {/* ---------- HOW LOGINS WORK ---------- */}
      <div className="flex flex-wrap items-start gap-3 rounded-3xl border bg-accent/50 p-5 text-sm">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-medium">Kirish qanday beriladi</p>
          <p className="text-muted-foreground">
            Xodimni email bilan qo'shsangiz, o'sha email avtomatik ruxsat oladi. Xodim{" "}
            <code className="rounded bg-background px-1">/auth</code> sahifasida ro'yxatdan o'tib,{" "}
            <span className="text-foreground">o'z parolini o'zi qo'yadi</span> — parolni siz ham,
            boshqa hech kim ham bilmaydi. Ro'yxatdan o'tgach hisob avtomatik shu xodimga bog'lanadi.
          </p>
        </div>
      </div>

      {/* ---------- ADD ---------- */}
      {draft ? (
        <div className="space-y-5 rounded-3xl border bg-card p-6 shadow-elegant">
          <h2 className="font-display text-2xl">Yangi xodim</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Ism-familiya</Label>
              <Input
                value={draft.full_name}
                maxLength={100}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lavozim</Label>
              <Select
                value={draft.position_id}
                onValueChange={(v) => setDraft({ ...draft, position_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <div key={d.id}>
                      <p className="px-2 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                        {d.name_uz}
                      </p>
                      {positionsOf(d.id).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title_uz}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input
                value={draft.phone}
                maxLength={30}
                placeholder="+998 90 123 45 67"
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email (kirish uchun)</Label>
              <Input
                type="email"
                value={draft.email}
                maxLength={255}
                placeholder="xodim@yesmine.uz"
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="hero" disabled={busy} onClick={add}>
              Saqlash
            </Button>
            <Button variant="soft" onClick={() => setDraft(null)}>
              Bekor qilish
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---------- BY DEPARTMENT ---------- */}
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      ) : (
        departments.map((d) => {
          const deptPositions = positionsOf(d.id);
          const deptStaff = deptPositions.flatMap((p) => staffOf(p.id));
          const deptPlanned = deptPositions.reduce((n, p) => n + p.headcount, 0);

          return (
            <section key={d.id} className="rounded-3xl border bg-card p-6 shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-xl">
                  <Users className="h-5 w-5 text-primary" /> {d.name_uz}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {deptStaff.length} / {deptPlanned} o'rin to'ldirilgan
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {deptPositions.map((p) => {
                  const people = staffOf(p.id);
                  const short = people.length < p.headcount;
                  return (
                    <div key={p.id} className="rounded-2xl border bg-background p-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{p.title_uz}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            short
                              ? "bg-amber-100 text-amber-800"
                              : "bg-accent text-accent-foreground",
                          )}
                        >
                          {people.length} / {p.headcount}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {p.permissions.includes("*")
                            ? "to'liq huquq"
                            : `${p.permissions.length} ta huquq`}
                        </span>
                      </div>

                      {people.length > 0 ? (
                        <ul className="mt-3 divide-y">
                          {people.map((e) => (
                            <li
                              key={e.id}
                              className="flex flex-wrap items-center gap-3 py-2 text-sm"
                            >
                              <span
                                className={cn(
                                  "font-medium",
                                  !e.active && "line-through opacity-60",
                                )}
                              >
                                {e.full_name}
                              </span>
                              {e.phone ? (
                                <span className="text-muted-foreground">{e.phone}</span>
                              ) : null}
                              {e.email ? (
                                <span className="text-muted-foreground">{e.email}</span>
                              ) : null}

                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs",
                                  e.user_id
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {e.user_id ? "hisob faol" : "hisob yaratilmagan"}
                              </span>

                              <div className="ml-auto flex items-center gap-1">
                                {!e.user_id && e.email ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      void navigator.clipboard.writeText(inviteText(e));
                                      toast.success("Taklif matni nusxalandi — xodimga yuboring");
                                    }}
                                  >
                                    <Copy className="mr-1 h-3.5 w-3.5" /> Taklif
                                  </Button>
                                ) : null}
                                <Button variant="ghost" size="sm" onClick={() => toggleActive(e)}>
                                  {e.active ? "Nofaol" : "Faollashtirish"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`${e.full_name} ni o'chirish`}
                                  onClick={() => remove(e)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDraft({ ...BLANK, position_id: p.id })}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" /> Bu o'ringa xodim qo'shish
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
