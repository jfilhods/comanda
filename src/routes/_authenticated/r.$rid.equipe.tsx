import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react"; // Ícone de lixeira
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createStaff, deleteStaff } from "@/lib/staff.functions";
import { ROLE_LABEL, type StaffRole } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/r/$rid/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Comanda" }] }),
  component: Team,
});

function Team() {
  const { rid } = Route.useParams();
  const qc = useQueryClient();
  const create = useServerFn(createStaff);
  const remove = useServerFn(deleteStaff);

  const [role, setRole] = useState<StaffRole>("garcom");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["members", rid],
    queryFn: async () => {
      const { data: m, error: membersError } = await supabase
        .from("restaurant_members")
        .select("*")
        .eq("restaurant_id", rid)
        .order("created_at");

      if (membersError) throw membersError;

      const ids = (m ?? []).map((x) => x.user_id);

      const { data: p, error: profilesError } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      // Mapeia os membros, mas o filtro abaixo vai remover quem não achou o profile
      return (
        (m ?? [])
          .map((x) => ({
            ...x,
            profile: p?.find((y) => y.id === x.user_id),
          }))
          // Só mantém na lista se o profile realmente existir (evita o "—")
          .filter((membro) => !!membro.profile)
      );
    },
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const fd = new FormData(form);
    const f = (key: string) => String(fd.get(key) ?? "").trim();

    const fullName = f("name");
    const password = f("password");
    const email = f("email");
    const username = f("username");

    if (!fullName) return toast.error("Informe o nome do funcionário.");
    if (!/^\d{8}$/.test(password)) return toast.error("A senha deve ter exatamente 8 números.");
    if (!email) return toast.error("Informe o e-mail.");
    if (!username) return toast.error("Informe o nome de usuário.");

    setBusy(true);
    try {
      await create({
        data: {
          restaurantId: rid,
          fullName,
          password,
          role,
          email: email.toLowerCase(),
          username: username.toLowerCase(),
        },
      });

      toast.success("Funcionário cadastrado com sucesso!");
      form.reset();
      setRole("garcom");
      await qc.invalidateQueries({ queryKey: ["members", rid] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("restaurant_members").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Funcionário ativado." : "Funcionário bloqueado.");
    await qc.invalidateQueries({ queryKey: ["members", rid] });
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId);
    try {
      await remove({ data: { userId, restaurantId: rid } });
      toast.success("Funcionário excluído do sistema.");
      await qc.invalidateQueries({ queryKey: ["members", rid] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir funcionário.");
    } finally {
      setDeletingId(null);
    }
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
                <div className="text-sm text-muted-foreground">
                  {/* Mostra @username para operacionais, e-mail para gerentes */}
                  {m.role === "gerente" ? m.profile?.email : `@${m.profile?.email}`}
                </div>
              </div>

              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                {ROLE_LABEL[m.role]}
              </span>

              <label className="flex items-center gap-2 text-sm mr-2">
                {m.active ? "Ativo" : "Bloqueado"}
                <Switch checked={m.active} onCheckedChange={(value) => toggle(m.id, value)} />
              </label>

              {/* BOTÃO DE EXCLUIR */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={deletingId === m.user_id}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {m.profile?.full_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é permanente. O funcionário perderá o acesso ao sistema
                      imediatamente e não poderá mais fazer login com estas credenciais. O histórico
                      de pedidos dele será mantido.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(m.user_id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deletingId === m.user_id ? "Excluindo..." : "Sim, excluir"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
          {!members.length && (
            <p className="p-6 text-muted-foreground">Ninguém cadastrado ainda.</p>
          )}
        </div>
      </section>

      <form onSubmit={onSubmit} className="card-surface h-fit space-y-3 p-5">
        <h2 className="text-lg font-bold">Cadastrar funcionário</h2>

        <div>
          <label className="mb-2 block text-sm font-medium">Cargo</label>
          <div className="flex flex-wrap gap-1">
            {(["garcom", "cozinha", "entregador", "gerente"] as StaffRole[]).map((r) => (
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
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Nome completo</label>
          <Input name="name" placeholder="Ex.: João da Silva" required />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">E-mail</label>
          <Input name="email" type="email" placeholder="email@exemplo.com" required />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Nome de usuário</label>
          <Input
            name="username"
            placeholder="Ex.: joao.silva"
            pattern="[a-z0-9._-]+"
            title="Letras minúsculas, números, ponto, hífen."
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {role === "gerente"
              ? "Opcional para login (gerente usa e-mail)."
              : "Usado para o funcionário fazer login."}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Senha inicial</label>
          <Input
            name="password"
            type="password"
            placeholder="8 números"
            pattern="[0-9]{8}"
            maxLength={8}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Cadastrando..." : "Cadastrar"}
        </Button>
      </form>
    </div>
  );
}
