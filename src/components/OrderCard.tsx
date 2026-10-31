/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  NEXT_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  brl,
  nextStep,
  time,
  type OrderStatus,
  type StaffRole,
} from "@/lib/status";

export type OrderRow = {
  id: string;
  number: number;
  status: OrderStatus;
  previous_status: OrderStatus | null;
  notes: string | null;
  total: number;
  cancel_reason: string | null;
  created_at: string;
  waiter_id: string;
  table: { label: string } | null;
  items: {
    status: string;
    product: any;
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes: string | null;
  }[];
};

export const ORDER_SELECT =
  "id, number, status, previous_status, notes, total, cancel_reason, created_at, waiter_id, session_id, table_id, table:dining_tables(label), items:order_items(id, product_name, quantity, unit_price, subtotal, notes)";

export async function changeStatus(id: string, to: OrderStatus, reason?: string) {
  const { error } = await supabase.rpc("set_order_status", {
    _order_id: id,
    _to: to,
    ...(reason ? { _reason: reason } : {}),
  });
  if (error) {
    toast.error(error.message);
    return false;
  }
  return true;
}

export function StatusBadge({ s }: { s: OrderStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[s]}`}>
      {STATUS_LABEL[s]}
    </span>
  );
}

function isBebida(nomeItem: string) {
  const n = nomeItem
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    n.includes("suco") ||
    n.includes("cerveja") ||
    n.includes("drink") ||
    n.includes("refrigerante") ||
    n.includes("agua") ||
    n.includes("dose") ||
    n.includes("long neck")
  );
}

export function OrderCard({
  o,
  role,
  big,
  highlight,
}: {
  o: OrderRow;
  role: StaffRole | "admin";
  big?: boolean;
  highlight?: boolean;
}) {
  const qc = useQueryClient();
  const next = nextStep(o.status, role);
  const mgr = role === "gerente" || role === "admin";
  const isGarcom = role === "garcom";
  const refresh = () => qc.invalidateQueries({ queryKey: ["orders"] });

  async function cancel() {
    const reason = window.prompt("Motivo do cancelamento:");
    if (!reason) return;
    const to: OrderStatus =
      o.status === "novo" || (mgr && o.status === "cancelamento_solicitado")
        ? "cancelado"
        : "cancelamento_solicitado";
    if (await changeStatus(o.id, to, reason)) refresh();
  }

  const allItemsAreBebidas = o.items.every((i) => isBebida(i.product_name));
  const onlyBebidasAndGarcom = isGarcom && allItemsAreBebidas;

  // O gerente e a cozinha sempre veem o fluxo real.
  // O garçom só vê "Entregue" no topo se for apenas bebida.
  const displayStatus = onlyBebidasAndGarcom ? "entregue" : o.status;

  return (
    <div className={`card-surface flex flex-col p-4 ${highlight ? "animate-new-order" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-display font-bold">
          <span className={big ? "text-2xl" : "text-lg"}>Mesa {o.table?.label}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            #{o.number} · {time(o.created_at)}
          </span>
        </div>
        <StatusBadge s={displayStatus as OrderStatus} />
      </div>
      <ul className={`mt-3 space-y-1.5 ${big ? "text-base" : "text-sm"}`}>
        {o.items.map((i) => {
          const itemIsBebida = isBebida(i.product_name);
          const showAsDelivered = isGarcom && itemIsBebida;

          return (
            <li key={i.id}>
              <div className="flex justify-between gap-2 items-center">
                <span>
                  <b>{i.quantity}×</b> {i.product_name}
                  <b>{i.product?.description && ` - ${i.product.description}`}</b>
                </span>
                <div className="flex items-center gap-2">
                  {!big && <span className="text-muted-foreground">{brl(i.subtotal)}</span>}
                  {showAsDelivered && (
                    <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Entregue
                    </span>
                  )}
                </div>
              </div>
              {i.notes && <div className="ml-6 text-sm font-medium text-primary">↳ {i.notes}</div>}
            </li>
          );
        })}
      </ul>
      {o.notes && <p className="mt-2 rounded-md bg-accent/30 px-2 py-1 text-sm">Obs.: {o.notes}</p>}
      {o.cancel_reason && <p className="mt-2 text-sm text-st-cancel">Motivo: {o.cancel_reason}</p>}
      {!big && <div className="mt-2 text-right font-semibold">{brl(o.total)}</div>}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {/* Se houver próximo passo, mostra o botão, EXCETO se for garçom e só tiver bebidas */}
        {next && !onlyBebidasAndGarcom && (
          <Button
            size={big ? "lg" : "sm"}
            className="flex-1"
            onClick={async () => (await changeStatus(o.id, next)) && refresh()}
          >
            {NEXT_LABEL[next]}
          </Button>
        )}

        {mgr && o.status === "cancelamento_solicitado" && o.previous_status && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => (await changeStatus(o.id, o.previous_status!)) && refresh()}
          >
            Recusar cancelamento
          </Button>
        )}
        {!["entregue", "cancelado"].includes(o.status) &&
          !(o.status === "cancelamento_solicitado" && !mgr) && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={cancel}>
              {o.status === "cancelamento_solicitado"
                ? "Aprovar cancelamento"
                : o.status === "novo"
                  ? "Cancelar"
                  : "Pedir cancelamento"}
            </Button>
          )}
      </div>
    </div>
  );
}
