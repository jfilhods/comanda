/* eslint-disable @typescript-eslint/no-explicit-any */
//routes/_authenticated/r.$rid.mesa.$tid.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Send, Receipt, Search, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { OrderCard, ORDER_SELECT, type OrderRow } from "@/components/OrderCard";
import { useRealtime, useRestaurantRole } from "@/lib/session";
import { TABLE_STATUS_LABEL, brl } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/r/$rid/mesa/$tid")({
  head: () => ({ meta: [{ title: "Conta da mesa — Comanda" }] }),
  component: TablePage,
});

type Line = { product_id: string; name: string; price: number; quantity: number; notes: string };

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

  const [search, setSearch] = useState("");

  // Estados para o fechamento da conta
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [payMethod1, setPayMethod1] = useState("pix");
  const [payValue1, setPayValue1] = useState("");
  const [payMethod2, setPayMethod2] = useState("dinheiro");
  const [payValue2, setPayValue2] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [receiptData, setReceiptData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

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
      const { data: t } = await supabase
        .from("dining_tables")
        .select("*, restaurants(name, address, phone)")
        .eq("id", tid)
        .single();
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

  const filteredMenu = menu
    .map((c) => {
      const items = c.products.filter((p) => {
        if (!p.active) return false;
        if (!search) return true;
        return normalizeStr(p.name).includes(normalizeStr(search));
      });
      return { ...c, products: items };
    })
    .filter((c) => c.products.length > 0);

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

  // Função para processar o fechamento
  async function handleCloseSession() {
    if (!sid || !table) return;

    const v1 = Number(payValue1.replace(",", ".")) || 0;
    const v2 = payValue2 ? Number(payValue2.replace(",", ".")) : 0;

    // Se preencheu o segundo valor, a soma deve bater
    if (v2 > 0 && Math.abs(v1 + v2 - consumed) > 0.01) {
      toast.error("A soma das formas de pagamento não bate com o total consumido.");
      return;
    }

    // Se não preencheu o valor 1, assume o total consumido
    const finalV1 = v1 === 0 && v2 === 0 ? consumed : v1;

    // Chama a RPC original (que já faz a validação no banco e libera a mesa)
    // Passamos a forma 1 como principal
    const { data, error } = await supabase.rpc("close_session", {
      _session_id: sid,
      _payment_method: payMethod1,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    // Se houver segunda forma de pagamento, atualiza a sessão com os detalhes extras
    if (v2 > 0) {
      await supabase
        .from("table_sessions")
        .update({
          amount_paid: finalV1,
          payment_method_2: payMethod2 as never,
          amount_paid_2: v2 as never,
        })
        .eq("id", sid);
    } else {
      // Atualiza o valor pago caso tenha sido pagamento único
      await supabase.from("table_sessions").update({ amount_paid: finalV1 }).eq("id", sid);
    }

    // Prepara os dados para o cupom
    setReceiptData({
      table: table.label,
      restaurant: table.restaurants,
      orders: orders.filter((o) => o.status !== "cancelado"),
      total: data, // O total retornado pela RPC
      p1: { method: payMethod1, value: finalV1 },
      p2: v2 > 0 ? { method: payMethod2, value: v2 } : null,
      date: new Date(),
    });

    setIsCloseOpen(false);
    setIsReceiptOpen(true);

    // Limpa os campos
    setPayValue1("");
    setPayValue2("");

    qc.invalidateQueries({ queryKey: ["table", tid] });
  }

  // Função para imprimir o cupom
  function handlePrint() {
    const printContent = printRef.current;
    if (!printContent) return;

    const originalTitle = document.title;
    document.title = `Conta_Mesa_${table?.label}`;

    const printWindow = window.open("", "", "height=600,width=400");
    if (!printWindow) {
      toast.error("Bloqueador de pop-up impediu a impressão.");
      return;
    }
    printWindow.document.write("<html><head><title>Comprovante</title>");
    printWindow.document.write("<style>");
    // Estilos inline para impressora térmica (80mm ou 58mm)
    printWindow.document.write(`
      body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; margin: 0 auto; color: #000; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .font-bold { font-weight: bold; }
      .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 2px 0; font-size: 12px; }
      .total { font-size: 14px; font-weight: bold; }
      h1, h2, h3 { margin: 4px 0; }
    `);
    printWindow.document.write("</style></head><body>");
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      document.title = originalTitle;
    }, 250);
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
          {/* BOTÃO QUE ABRE O MODAL DE FECHAMENTO */}
          {sid && mgr && (
            <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
              <DialogTrigger asChild>
                <Button>Registrar pagamento e encerrar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fechar Conta - Mesa {table?.label}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex justify-between rounded-lg bg-muted p-3 font-bold">
                    <span>Total Consumido:</span>
                    <span>{brl(consumed)}</span>
                  </div>

                  <div className="space-y-3">
                    <Label>Forma de Pagamento 1</Label>
                    <div className="flex gap-2">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={payMethod1}
                        onChange={(e) => setPayMethod1(e.target.value)}
                      >
                        <option value="pix">PIX</option>
                        <option value="debito">Cartão de Débito</option>
                        <option value="credito">Cartão de Crédito</option>
                        <option value="dinheiro">Dinheiro</option>
                      </select>
                      <Input
                        placeholder="Valor (R$)"
                        inputMode="decimal"
                        value={payValue1}
                        onChange={(e) => setPayValue1(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Forma de Pagamento 2 (Opcional)</Label>
                    <div className="flex gap-2">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={payMethod2}
                        onChange={(e) => setPayMethod2(e.target.value)}
                      >
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="debito">Cartão de Débito</option>
                        <option value="credito">Cartão de Crédito</option>
                      </select>
                      <Input
                        placeholder="Valor (R$)"
                        inputMode="decimal"
                        value={payValue2}
                        onChange={(e) => setPayValue2(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deixe o valor em branco se for pagamento único.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCloseOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCloseSession}>Concluir e Gerar Cupom</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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
          {filteredMenu.map((c) => (
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
          ))}

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

      {/* --- MODAL DO CUPOM (NOTA FISCAL SIMPLIFICADA) --- */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Conta Encerrada!</DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto bg-white p-2">
            {/* CONTAINER DO CUPOM - ESTILIZADO PARA IMPRESSORA */}
            <div ref={printRef} className="text-black font-mono text-sm mx-auto max-w-[300px]">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold uppercase">
                  {receiptData?.restaurant?.name || "RESTAURANTE"}
                </h2>
                {receiptData?.restaurant?.address && (
                  <p className="text-xs">{receiptData.restaurant.address}</p>
                )}
                {receiptData?.restaurant?.phone && (
                  <p className="text-xs">Tel: {receiptData.restaurant.phone}</p>
                )}
                <p className="text-xs mt-2">CNPJ: 00.000.000/0000-00</p>
              </div>

              <div className="divider"></div>

              <div className="text-xs mb-2">
                <p>
                  <strong>Data:</strong> {receiptData?.date.toLocaleString("pt-BR")}
                </p>
                <p>
                  <strong>Mesa:</strong> {receiptData?.table}
                </p>
              </div>

              <div className="divider"></div>

              <table>
                <thead>
                  <tr>
                    <th className="text-left">Qtd</th>
                    <th className="text-left">Item</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData?.orders.map((o: any) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    o.items.map((i: any) => (
                      <tr key={i.id}>
                        <td>{i.quantity}x</td>
                        <td>{i.product_name}</td>
                        <td className="text-right">{brl(i.subtotal)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>

              <div className="divider"></div>

              <div className="flex justify-between font-bold text-base mt-2">
                <span>TOTAL:</span>
                <span>{brl(receiptData?.total || 0)}</span>
              </div>

              <div className="divider"></div>

              <div className="text-xs">
                <p>
                  Pagamento 1: {receiptData?.p1.method} - {brl(receiptData?.p1.value || 0)}
                </p>
                {receiptData?.p2 && (
                  <p>
                    Pagamento 2: {receiptData.p2.method} - {brl(receiptData.p2.value)}
                  </p>
                )}
              </div>

              <div className="divider"></div>

              <div className="text-center text-xs mt-4">
                <p>Obrigado pela preferência!</p>
                <p>Volte sempre.</p>
                <p className="mt-2">www.comanda.app</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full" onClick={() => setIsReceiptOpen(false)}>
              Fechar sem Imprimir
            </Button>
            <Button className="w-full" onClick={handlePrint}>
              <Printer className="mr-2 size-4" /> Imprimir Cupom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
