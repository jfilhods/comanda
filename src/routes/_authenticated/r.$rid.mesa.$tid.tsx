//routes/_authenticated/r.$rid.mesa.$tid.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Send, Receipt, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OrderCard, ORDER_SELECT, type OrderRow } from "@/components/OrderCard";
import { useRealtime, useRestaurantRole } from "@/lib/session";
import { TABLE_STATUS_LABEL, brl } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/r/$rid/mesa/$tid")({
  head: () => ({ meta: [{ title: "Conta da mesa — Comanda" }] }),
  component: TablePage,
});

type Line = { product_id: string; name: string; price: number; quantity: number; notes: string };

// Função helper para ignorar acentos na busca
function normalizeStr(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function TablePage() {
  const { rid, tid } = Route.useParams();
  const role = useRestaurantRole(rid)!;
  const qc = useQueryClient();

  // Estado da busca
  const [search, setSearch] = useState("");

  useRealtime(
    rid,
    ["orders", "dining_tables", "table_sessions"],
    [
      ["orders", rid],
      ["table", tid],
    ],
  );

  const { data: table } = useQuery({
    queryKey: ["table", tid],
    queryFn: async () => {
      const { data: t } = await supabase.from("dining_tables").select("*").eq("id", tid).single();
      const { data: s } = await supabase
        .from("table_sessions")
        .select("*")
        .eq("table_id", tid)
        .eq("status", "aberta")
        .maybeSingle();
      return { ...t!, session: s };
    },
  });
  const sid = table?.session?.id;
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", rid, "session", sid],
    enabled: !!sid,
    queryFn: async () =>
      ((
        await supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("session_id", sid!)
          .order("created_at")
      ).data ?? []) as unknown as OrderRow[],
  });
  const { data: menu = [] } = useQuery({
    queryKey: ["menu", rid],
    queryFn: async () =>
      (
        await supabase
          .from("categories")
          .select("id, name, products(id, name, price, available, active, description)")
          .eq("restaurant_id", rid)
          .eq("active", true)
          .order("position")
      ).data ?? [],
  });

  const [cart, setCart] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const total = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const consumed = orders
    .filter((o) => o.status !== "cancelado")
    .reduce((s, o) => s + Number(o.total), 0);
  const mgr = role === "gerente" || role === "admin";

  // Filtra os produtos baseado na busca
  const filteredMenu = menu
    .map((c) => {
      const items = c.products.filter((p) => {
        if (!p.active) return false;
        if (!search) return true;
        return normalizeStr(p.name).includes(normalizeStr(search));
      });
      return { ...c, products: items };
    })
    .filter((c) => c.products.length > 0); // Esconde categorias vazias após filtro

  function add(p: { id: string; name: string; price: number }) {
    setCart((c) => {
      const ex = c.find((l) => l.product_id === p.id);
      if (ex) return c.map((l) => (l === ex ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...c,
        { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1, notes: "" },
      ];
    });
  }
  function upd(i: number, patch: Partial<Line>) {
    setCart((c) =>
      c.map((l, j) => (j === i ? { ...l, ...patch } : l)).filter((l) => l.quantity > 0),
    );
  }
  async function send() {
    setBusy(true);
    const { error } = await supabase.rpc("create_order", {
      _table_id: tid,
      _items: cart.map(({ product_id, quantity, notes }) => ({ product_id, quantity, notes })),
      _notes: notes,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pedido enviado para a cozinha");
    setCart([]);
    setNotes("");
    qc.invalidateQueries({ queryKey: ["table", tid] });
    qc.invalidateQueries({ queryKey: ["orders", rid] });
  }
  async function requestBill() {
    const { error } = await supabase.rpc("request_bill", { _table_id: tid });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["table", tid] });
  }
  async function close() {
    const method = window.prompt("Forma de pagamento (dinheiro, pix, cartão):", "pix");
    if (!method || !sid) return;
    const { data, error } = await supabase.rpc("close_session", {
      _session_id: sid,
      _payment_method: method,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Conta encerrada: ${brl(data)}`);
    qc.invalidateQueries({ queryKey: ["table", tid] });
  }

  return (
    <div>
      <Link
        to="/r/$rid/mesas"
        params={{ rid }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mesas
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold">Mesa {table?.label}</h1>
          <p className="text-muted-foreground">
            {table && TABLE_STATUS_LABEL[table.status]}{" "}
            {sid ? `· conta aberta · consumo ${brl(consumed)}` : "· sem conta aberta"}
          </p>
        </div>
        <div className="flex gap-2">
          {sid && table?.status !== "aguardando_pagamento" && (
            <Button variant="outline" onClick={requestBill}>
              <Receipt /> Pedir conta
            </Button>
          )}
          {sid && mgr && <Button onClick={close}>Registrar pagamento e encerrar</Button>}
        </div>
      </div>

      {/* BARRA DE BUSCA */}
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto (ex.: peixada, coca, sobremesa...)"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          {/* Usa o filteredMenu em vez do menu original */}
          {filteredMenu.map((c) => {
            return (
              <div key={c.id}>
                <h2 className="mb-2 text-lg font-bold">{c.name}</h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {c.products.map((p) => (
                    <button
                      key={p.id}
                      disabled={!p.available}
                      onClick={() => add(p)}
                      className="card-surface flex items-center justify-between gap-2 p-3 text-left transition hover:border-primary disabled:opacity-40"
                    >
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {p.available ? brl(p.price) : "Indisponível"}
                        </div>
                      </div>
                      <Plus className="size-5 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Mensagens de estado vazio */}
          {menu.length === 0 && <p className="text-muted-foreground">Cardápio vazio.</p>}
          {menu.length > 0 && filteredMenu.length === 0 && (
            <p className="text-muted-foreground">Nenhum produto encontrado para "{search}".</p>
          )}

          {orders.length > 0 && (
            <div>
              <h2 className="mb-2 text-lg font-bold">Pedidos desta conta</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {orders.map((o) => (
                  <OrderCard key={o.id} o={o} role={role} />
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="card-surface h-fit p-4 lg:sticky lg:top-20">
          <h2 className="text-lg font-bold">Novo pedido</h2>
          {cart.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Toque nos produtos para adicionar.</p>
          )}
          <ul className="mt-3 space-y-3">
            {cart.map((l, i) => (
              <li key={l.product_id} className="space-y-1.5 border-b pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{l.name}</span>
                  <span className="text-sm">{brl(l.price * l.quantity)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    onClick={() => upd(i, { quantity: l.quantity - 1 })}
                  >
                    <Minus />
                  </Button>
                  <span className="w-6 text-center font-semibold">{l.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-7"
                    onClick={() => upd(i, { quantity: l.quantity + 1 })}
                  >
                    <Plus />
                  </Button>
                  <span className="text-xs text-muted-foreground">{brl(l.price)} un.</span>
                </div>
                <Input
                  placeholder="Observação (ex.: sem cebola)"
                  value={l.notes}
                  onChange={(e) => upd(i, { notes: e.target.value })}
                  className="h-8"
                />
              </li>
            ))}
          </ul>
          {cart.length > 0 && (
            <>
              <Textarea
                className="mt-3"
                placeholder="Observação geral do pedido"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="mt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{brl(total)}</span>
              </div>
              <Button className="mt-3 w-full" size="lg" disabled={busy} onClick={send}>
                <Send /> Enviar para a cozinha
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Preços conferidos pelo sistema no envio.
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
