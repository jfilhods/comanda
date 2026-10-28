import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, History, DollarSign, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OrderCard, ORDER_SELECT, type OrderRow } from "@/components/OrderCard";
import { useRealtime, useRestaurantRole } from "@/lib/session";
import { STATUS_LABEL, brl, type OrderStatus } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/r/$rid/painel")({
  head: () => ({ meta: [{ title: "Painel do gerente — Comanda" }] }),
  component: Dashboard,
});

type SessionRow = {
  id: string;
  table_id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  payment_method: string | null;
  amount_paid: number | null;
  table: { label: string } | null;
};

function Dashboard() {
  const { rid } = Route.useParams();
  const role = useRestaurantRole(rid)!;
  const qc = useQueryClient();
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");
  useRealtime(
    rid,
    ["orders", "dining_tables", "table_sessions"],
    [
      ["orders", rid],
      ["tables", rid],
      ["sessions", rid],
    ],
  );

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  // --- Pedidos do dia (para KPIs e listagem) ---
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", rid, "today"],
    queryFn: async () =>
      ((
        await supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("restaurant_id", rid)
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: false })
      ).data ?? []) as unknown as OrderRow[],
  });

  // --- Sessões fechadas (para o relatório de faturamento) ---
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", rid, "closed"],
    queryFn: async () =>
      ((
        await supabase
          .from("table_sessions")
          .select("*, table:dining_tables(label)")
          .eq("restaurant_id", rid)
          .eq("status", "fechada")
          .gte("closed_at", start.toISOString())
          .order("closed_at", { ascending: false })
      ).data ?? []) as unknown as SessionRow[],
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["tables", rid],
    queryFn: async () =>
      (await supabase.from("dining_tables").select("*").eq("restaurant_id", rid).order("label"))
        .data ?? [],
  });

  // --- Cálculos de Faturamento ---
  const validOrders = orders.filter((o) => o.status !== "cancelado");
  const totalVendasDia = validOrders.reduce((s, o) => s + Number(o.total), 0);

  const totalFechadoHoje = sessions.reduce((s, x) => s + Number(x.amount_paid || 0), 0);
  const ticketMedioMesa = sessions.length ? totalFechadoHoje / sessions.length : 0;

  const pagamentos = sessions.reduce(
    (acc, s) => {
      const m = s.payment_method || "Outro";
      acc[m] = (acc[m] || 0) + Number(s.amount_paid || 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  // --- KPIs ---
  const count = (s: OrderStatus[]) => orders.filter((o) => s.includes(o.status)).length;
  const kpis = [
    { l: "Pedidos hoje", v: orders.length },
    { l: "Novos", v: count(["novo"]) },
    { l: "Em preparo", v: count(["aceito", "em_preparo"]) },
    { l: "Prontos", v: count(["pronto"]) },
    { l: "Entregues", v: count(["entregue"]) },
    { l: "Mesas ocupadas", v: tables.filter((t) => t.status !== "livre").length },
    { l: "Mesas livres", v: tables.filter((t) => t.status === "livre").length },
    {
      l: "Aguardando pagamento",
      v: tables.filter((t) => t.status === "aguardando_pagamento").length,
    },
    { l: "Vendas do dia (pedidos)", v: brl(totalVendasDia) },
    { l: "Ticket médio", v: brl(validOrders.length ? totalVendasDia / validOrders.length : 0) },
  ];

  const shown = filter === "todos" ? orders : orders.filter((o) => o.status === filter);

  async function addTable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("dining_tables").insert({
      restaurant_id: rid,
      label: String(f.get("label")),
      capacity: Number(f.get("capacity")) || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    e.currentTarget.reset();
    qc.invalidateQueries({ queryKey: ["tables", rid] });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold">Painel do dia</h1>

      {/* --- KPIs Rápidos --- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.l} className="card-surface p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {k.l}
            </div>
            <div className="mt-1 font-display text-2xl font-extrabold">{k.v}</div>
          </div>
        ))}
      </div>

      {/* --- Seção de Faturamento e Histórico --- */}
      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <History className="text-primary" />
            <h2 className="text-xl font-bold">Histórico de Contas Fechadas</h2>
          </div>
          {!sessions.length && <p className="text-muted-foreground">Nenhuma conta fechada hoje.</p>}
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3"
              >
                <div>
                  <div className="font-semibold">Mesa {s.table?.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.opened_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {s.closed_at
                      ? new Date(s.closed_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Em aberto"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold uppercase">
                    {s.payment_method || "N/I"}
                  </span>
                  <span className="font-bold text-primary">{brl(s.amount_paid || 0)}</span>
                  <SessionDialog sessionId={s.id} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-surface p-5 h-fit">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="text-primary" />
            <h2 className="text-xl font-bold">Por Forma de Pagamento</h2>
          </div>
          {Object.keys(pagamentos).length === 0 && (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          )}
          <ul className="space-y-3">
            {Object.entries(pagamentos).map(([metodo, valor]) => (
              <li key={metodo} className="flex items-center justify-between border-b pb-2">
                <span className="font-medium capitalize">{metodo}</span>
                <span className="font-bold">{brl(valor)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="font-semibold">Total Fechado</span>
            <span className="text-lg font-bold text-primary">{brl(totalFechadoHoje)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ticket Médio por Mesa</span>
            <span className="text-sm font-semibold">{brl(ticketMedioMesa)}</span>
          </div>
        </div>
      </section>

      {/* --- Pedidos em Andamento --- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-xl font-bold">Pedidos em Andamento</h2>
          {(["todos", ...Object.keys(STATUS_LABEL)] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s as OrderStatus | "todos")}
            >
              {s === "todos" ? "Todos" : STATUS_LABEL[s as OrderStatus]}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((o) => (
            <OrderCard key={o.id} o={o} role={role} />
          ))}
          {!shown.length && <p className="text-muted-foreground">Nenhum pedido.</p>}
        </div>
      </section>

      {/* --- Gestão de Mesas --- */}
      <section className="card-surface p-5">
        <h2 className="text-xl font-bold">Gestão de Mesas</h2>
        <form onSubmit={addTable} className="mt-3 flex flex-wrap gap-2">
          <Input name="label" placeholder="Número/nome" required className="w-40" />
          <Input name="capacity" type="number" min={1} placeholder="Lugares" className="w-28" />
          <Button type="submit">
            <Plus /> Adicionar mesa
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {tables.map((t) => (
            <span
              key={t.id}
              className={`rounded-lg border px-3 py-1.5 text-sm ${t.status !== "livre" ? "bg-orange-100 border-orange-300 text-orange-800" : "bg-background"}`}
            >
              <b>{t.label}</b> {t.capacity ? `· ${t.capacity} lug.` : ""}{" "}
              <span className="text-xs ml-1 uppercase">{t.status}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

// --- Modal para ver os detalhes da sessão fechada ---
function SessionDialog({ sessionId }: { sessionId: string }) {
  const { data: orders = [] } = useQuery({
    queryKey: ["session-orders", sessionId],
    queryFn: async () =>
      ((
        await supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("session_id", sessionId)
          .order("created_at")
      ).data ?? []) as unknown as OrderRow[],
  });

  const total = orders
    .filter((o) => o.status !== "cancelado")
    .reduce((s, o) => s + Number(o.total), 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Ver detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Fechamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between font-bold border-b pb-2">
            <span>Total Consumido</span>
            <span>{brl(total)}</span>
          </div>
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between font-semibold mb-2">
                  <span>Pedido #{o.number}</span>
                  <span>{o.status === "cancelado" ? "CANCELADO" : brl(o.total)}</span>
                </div>
                <ul className="text-muted-foreground">
                  {o.items?.map((i) => (
                    <li key={i.id} className="flex justify-between">
                      <span>
                        {i.quantity}x {i.product_name}
                      </span>
                      <span>{brl(i.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!orders.length && (
              <p className="text-muted-foreground text-center">Nenhum pedido registrado.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
