import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useRealtime, useRestaurantRole } from "@/lib/session";
import { TABLE_STATUS_LABEL, brl } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/r/$rid/mesas")({
  head: () => ({ meta: [{ title: "Mesas — Comanda" }] }),
  component: TablesPage,
});

type TableRow = {
  id: string;
  label: string;
  capacity: number | null;
  status: "livre" | "ocupada" | "aguardando_pagamento" | "em_encerramento";
};

function TablesPage() {
  const { rid } = Route.useParams();
  const role = useRestaurantRole(rid)!;
  const qc = useQueryClient();
  const mgr = role === "gerente" || role === "admin";

  useRealtime(
    rid,
    ["dining_tables", "table_sessions"],
    [
      ["tables", rid],
      ["table_sessions", rid],
    ],
  );

  const { data: tables = [] } = useQuery({
    queryKey: ["tables", rid],
    queryFn: async () =>
      ((await supabase.from("dining_tables").select("*").eq("restaurant_id", rid).order("label"))
        .data ?? []) as TableRow[],
  });

  // Busca sessões abertas para saber o valor consumido de cada mesa
  const { data: openSessions = [] } = useQuery({
    queryKey: ["table_sessions", rid, "open"],
    queryFn: async () =>
      (
        await supabase
          .from("table_sessions")
          .select("id, table_id, orders(total, status)")
          .eq("restaurant_id", rid)
          .eq("status", "aberta")
      ).data ?? [],
  });

  // Mapa auxiliar: table_id -> { session_id, total }
  const sessionMap = openSessions.reduce(
    (acc, s) => {
      const total = s.orders
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((o: any) => o.status !== "cancelado")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((sum: number, o: any) => sum + Number(o.total), 0);
      acc[s.table_id] = { id: s.id, total };
      return acc;
    },
    {} as Record<string, { id: string; total: number }>,
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tables", rid] });
    qc.invalidateQueries({ queryKey: ["table_sessions", rid, "open"] });
  };

  async function addTable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase.from("dining_tables").insert({
      restaurant_id: rid,
      label: String(f.get("label")).trim(),
      capacity: Number(f.get("capacity")) || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    form.reset();
    refresh();
    toast.success("Mesa adicionada");
  }

  async function deleteTable(id: string, label: string) {
    // Bloqueia exclusão se houver sessão aberta
    if (sessionMap[id]) {
      toast.error("Não é possível excluir uma mesa com conta aberta.");
      return;
    }
    const { error } = await supabase.from("dining_tables").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success(`Mesa ${label} excluída`);
  }

  async function forceFree(id: string, label: string) {
    if (!confirm(`Forçar liberação da mesa ${label}? Use apenas se a conta já foi paga ou travou.`))
      return;

    // 1. Tenta fechar sessão órfã (caso exista)
    const sid = sessionMap[id]?.id;
    if (sid) {
      await supabase
        .from("table_sessions")
        .update({
          status: "fechada",
          closed_at: new Date().toISOString(),
          payment_method: "manual_force",
        })
        .eq("id", sid);
    }

    // 2. Libera a mesa
    const { error } = await supabase.from("dining_tables").update({ status: "livre" }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success(`Mesa ${label} liberada manualmente`);
  }

  // Cores por status
  const STATUS_STYLE: Record<string, string> = {
    livre: "border-green-200 bg-green-50 hover:border-green-400",
    ocupada: "border-orange-200 bg-orange-50 hover:border-orange-400",
    aguardando_pagamento: "border-blue-200 bg-blue-50 hover:border-blue-400",
    em_encerramento: "border-gray-300 bg-gray-100",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Mesas</h1>
          <p className="text-muted-foreground">
            {tables.filter((t) => t.status === "livre").length} livres de {tables.length} totais
          </p>
        </div>
        {mgr && (
          <form onSubmit={addTable} className="flex flex-wrap items-center gap-2">
            <Input name="label" placeholder="Nº/Nome" required className="w-28" />
            <Input name="capacity" type="number" min={1} placeholder="Lugares" className="w-24" />
            <Button type="submit">
              <Plus /> Nova Mesa
            </Button>
          </form>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => {
          const session = sessionMap[t.id];
          return (
            <div
              key={t.id}
              className={`relative flex flex-col justify-between rounded-2xl border-2 p-4 transition-all ${STATUS_STYLE[t.status] || "bg-background"}`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <h2 className="text-2xl font-extrabold">{t.label}</h2>
                  {mgr && (
                    <div className="flex gap-1">
                      <TableDialog table={t} onSaved={refresh}>
                        <Button size="icon" variant="ghost" className="size-8">
                          <Pencil className="size-4" />
                        </Button>
                      </TableDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir mesa {t.label}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTable(t.id, t.label)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="size-3" />
                  {t.capacity ? `${t.capacity} lugares` : "Sem limite"}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold uppercase tracking-wider text-xs">
                    {TABLE_STATUS_LABEL[t.status]}
                  </span>
                  {session && <span className="font-bold">{brl(session.total)}</span>}
                </div>
                <div className="flex gap-2">
                  {t.status === "livre" ? (
                    <Button asChild className="w-full" variant="default">
                      <Link to="/r/$rid/mesa/$tid" params={{ rid, tid: t.id }}>
                        Abrir Mesa
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild className="flex-1" variant="secondary">
                        <Link to="/r/$rid/mesa/$tid" params={{ rid, tid: t.id }}>
                          Ver Conta
                        </Link>
                      </Button>
                      {mgr && (
                        <Button
                          size="icon"
                          variant="outline"
                          title="Forçar liberação"
                          onClick={() => forceFree(t.id, t.label)}
                        >
                          <CheckCircle2 className="size-4 text-green-600" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Dialog para editar mesa ---
function TableDialog({
  table,
  onSaved,
  children,
}: {
  table: TableRow;
  onSaved: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("dining_tables")
      .update({
        label: String(f.get("label")).trim(),
        capacity: Number(f.get("capacity")) || null,
      })
      .eq("id", table.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mesa atualizada");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Mesa {table.label}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="label">Identificação</Label>
            <Input id="label" name="label" defaultValue={table.label} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="capacity">Capacidade (lugares)</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              defaultValue={table.capacity || ""}
            />
          </div>
          <Button type="submit">Salvar Alterações</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
