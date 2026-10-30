/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantRole } from "@/lib/session";
import { brl } from "@/lib/status";
import { CalendarDays, DollarSign, Wallet, TrendingUp, Receipt } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/r/$rid/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Comanda" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { rid } = Route.useParams();
  const role = useRestaurantRole(rid);

  // Busca as sessões fechadas do dia
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["reports", rid, "sessions", startOfDay.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_sessions")
        .select(
          `
          *,
          table:dining_tables(label),
          orders(total, status)
        `,
        )
        .eq("restaurant_id", rid)
        .eq("status", "fechada")
        .gte("closed_at", startOfDay.toISOString())
        .order("closed_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Array<
        (typeof data)[number] & {
          payment_method_2?: string | null;
          amount_paid_2?: number | null;
        }
      >;
    },
  });

  // Cálculos de KPIs
  const totalFaturado = sessions.reduce((acc, s) => acc + Number(s.amount_paid || 0), 0);
  const totalMesas = sessions.length;
  const ticketMedio = totalMesas > 0 ? totalFaturado / totalMesas : 0;

  // Agrupamento por Forma de Pagamento
  const pagamentos: Record<string, number> = {};
  sessions.forEach((s) => {
    // Pagamento 1
    if ((s.amount_paid ?? 0) > 0) {
      const method = (s.payment_method || "outro").toLowerCase();
      pagamentos[method] = (pagamentos[method] || 0) + Number(s.amount_paid);
    }
    // Pagamento 2 (se houver)
    if ((s.amount_paid_2 ?? 0) > 0) {
      const method2 = (s.payment_method_2 || "outro").toLowerCase();
      pagamentos[method2] = (pagamentos[method2] || 0) + Number(s.amount_paid_2);
    }
  });

  if (role === "garcom" || role === "cozinha") {
    return <div className="p-8 text-center text-muted-foreground">Acesso restrito à gerência.</div>;
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <TrendingUp className="text-primary" /> Relatórios do Dia
        </h1>
        <p className="text-muted-foreground">
          Resumo financeiro referente a {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-surface p-6 flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full text-primary">
            <DollarSign className="size-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Faturamento Total</p>
            <p className="text-3xl font-bold">{brl(totalFaturado)}</p>
          </div>
        </div>

        <div className="card-surface p-6 flex items-center gap-4">
          <div className="p-3 bg-secondary rounded-full text-secondary-foreground">
            <Receipt className="size-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Contas Fechadas</p>
            <p className="text-3xl font-bold">{totalMesas}</p>
          </div>
        </div>

        <div className="card-surface p-6 flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded-full text-accent-foreground">
            <CalendarDays className="size-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ticket Médio</p>
            <p className="text-3xl font-bold">{brl(ticketMedio)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* POR FORMA DE PAGAMENTO */}
        <div className="lg:col-span-1 card-surface p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Wallet className="size-5" /> Formas de Pagamento
          </h2>
          {Object.keys(pagamentos).length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pagamento registrado hoje.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(pagamentos).map(([method, value]) => (
                <div key={method} className="flex flex-col gap-1 border-b pb-2 last:border-0">
                  <div className="flex justify-between items-center">
                    <span className="uppercase text-sm font-semibold text-muted-foreground">
                      {method}
                    </span>
                    <span className="font-bold">{brl(value)}</span>
                  </div>
                  {/* Barra de progresso visual */}
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(value / totalFaturado) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HISTÓRICO DE CONTAS */}
        <div className="lg:col-span-2 card-surface p-5">
          <h2 className="text-lg font-bold mb-4">Histórico de Contas Fechadas</h2>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mesa</TableHead>
                  <TableHead>Abertura/Fechamento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      Nenhuma conta fechada hoje.
                    </TableCell>
                  </TableRow>
                )}
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-semibold">
                      Mesa {(s.table as any)?.label || "?"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.opened_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" - "}
                      {s.closed_at
                        ? new Date(s.closed_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="uppercase text-xs font-semibold">
                      {s.payment_method}
                      {s.payment_method_2 && ` + ${s.payment_method_2}`}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {brl(s.amount_paid || 0)}
                      {typeof s.amount_paid_2 === "number" && s.amount_paid_2 > 0 && (
                        <span className="text-xs text-muted-foreground block">
                          + {brl(s.amount_paid_2)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
