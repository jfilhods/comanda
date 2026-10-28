import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createStaff } from "@/lib/staff.functions";
import { ROLE_LABEL, type StaffRole } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/r/$rid/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Comanda" }] }),
  component: Team,
});

function Team() {
  const { rid } = Route.useParams();
  const qc = useQueryClient();
  const create = useServerFn(createStaff);
  const [role, setRole] = useState<StaffRole>("garcom");
  const [busy, setBusy] = useState(false);
  const { data: members = [] } = useQuery({
    queryKey: ["members", rid],
    queryFn: async () => {
      const { data: m } = await supabase
        .from("restaurant_members")
        .select("*")
        .eq("restaurant_id", rid)
        .order("created_at");
      const ids = (m ?? []).map((x) => x.user_id);
      const { data: p } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] };
      return (m ?? []).map((x) => ({ ...x, profile: p?.find((y) => y.id === x.user_id) }));
    },
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const f = (k: string) => String(fd.get(k) ?? "");
    setBusy(true);
    try {
      await create({
        data: {
          restaurantId: rid,
          fullName: f("name"),
          email: f("email"),
          password: f("password"),
          role,
        },
      });
      toast.success("Funcionário cadastrado");
      form.reset();
      qc.invalidateQueries({ queryKey: ["members", rid] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("restaurant_members").update({ active }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["members", rid] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <h1 className="mb-4 text-3xl font-extrabold">Equipe</h1>
        <div className="card-surface divide-y">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-4">
              <div className="flex-1">
                <div className="font-semibold">{m.profile?.full_name ?? "—"}</div>
                <div className="text-sm text-muted-foreground">{m.profile?.email}</div>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                {ROLE_LABEL[m.role]}
              </span>
              <label className="flex items-center gap-2 text-sm">
                {m.active ? "Ativo" : "Bloqueado"}{" "}
                <Switch checked={m.active} onCheckedChange={(v) => toggle(m.id, v)} />
              </label>
            </div>
          ))}
          {!members.length && (
            <p className="p-6 text-muted-foreground">Ninguém cadastrado ainda.</p>
          )}
        </div>
      </section>
      <form onSubmit={onSubmit} className="card-surface h-fit space-y-3 p-5">
        <h2 className="text-lg font-bold">Cadastrar funcionário</h2>
        <div className="flex gap-1">
          {(["garcom", "cozinha", "gerente"] as StaffRole[]).map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={role === r ? "default" : "outline"}
              onClick={() => setRole(r)}
            >
              {ROLE_LABEL[r]}
            </Button>
          ))}
        </div>
        <Input name="name" placeholder="Nome completo" required />
        <Input name="email" type="email" placeholder="E-mail" required />
        <Input
          name="password"
          type="password"
          placeholder="Senha inicial (mín. 8)"
          minLength={8}
          required
        />
        <Button type="submit" className="w-full" disabled={busy}>
          Cadastrar
        </Button>
        <p className="text-xs text-muted-foreground">
          Entregue a senha inicial pessoalmente. Se o e-mail já tiver conta, ela é vinculada a este
          restaurante.
        </p>
      </form>
    </div>
  );
}
