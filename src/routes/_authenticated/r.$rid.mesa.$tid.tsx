/* eslint-disable @typescript-eslint/no-explicit-any */
//routes/_authenticated/r.$rid.mesa.$tid.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Send, Receipt, Search, Printer, ShoppingCart } from "lucide-react";
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
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  // Todos os produtos achatados para a busca
  const allProducts = menu
    .flatMap((c) => c.products.map((p) => ({ ...p, categoryName: c.name })))
    .filter((p) => p.active);

  // Lógica de busca
  const searchResults = search.trim()
    ? allProducts.filter((p) => normalizeStr(p.name).includes(normalizeStr(search)))
    : [];

  function add(p: { id: string; name: string; price: number }) {
    setCart((c) => {
      const ex = c.find((l) => l.product_id === p.id);
      if (ex) return c.map((l) => (l === ex ? { ...l, quantity: l.quantity + 1 } : l));
      return [
        ...c,
        { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1, notes: "" },
      ];
    });
    // Vibração tátil para confirmar a adição
    if (navigator.vibrate) navigator.vibrate(50);
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
    setIsCartOpen(false); // Fecha o carrinho após enviar
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

  async function handleCloseSession() {
    if (!sid || !table) return;
    const v1 = Number(payValue1.replace(",", ".")) || 0;
    const v2 = payValue2 ? Number(payValue2.replace(",", ".")) : 0;

    if (v2 > 0 && Math.abs(v1 + v2 - consumed) > 0.01) {
      toast.error("A soma das formas de pagamento não bate com o total consumido.");
      return;
    }

    const finalV1 = v1 === 0 && v2 === 0 ? consumed : v1;

    const { data, error } = await supabase.rpc("close_session", {
      _session_id: sid,
      _payment_method: payMethod1,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

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
      await supabase.from("table_sessions").update({ amount_paid: finalV1 }).eq("id", sid);
    }

    setReceiptData({
      table: table.label,
      restaurant: table.restaurants,
      orders: orders.filter((o) => o.status !== "cancelado"),
      total: data,
      p1: { method: payMethod1, value: finalV1 },
      p2: v2 > 0 ? { method: payMethod2, value: v2 } : null,
      date: new Date(),
    });

    setIsCloseOpen(false);
    setIsReceiptOpen(true);
    setPayValue1("");
    setPayValue2("");
    qc.invalidateQueries({ queryKey: ["table", tid] });
  }

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
    printWindow.document.write(
      "<html><head><title>Comprovante</title><style>body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; margin: 0 auto; color: #000; } .text-center { text-align: center; } .text-right { text-align: right; } .font-bold { font-weight: bold; } .divider { border-bottom: 1px dashed #000; margin: 8px 0; } table { width: 100%; border-collapse: collapse; } th, td { padding: 2px 0; font-size: 12px; } .total { font-size: 14px; font-weight: bold; } h1, h2, h3 { margin: 4px 0; }</style></head><body>",
    );
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
    <div className="pb-24">
      {/* CABEÇALHO FIXO */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-2 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              to="/r/$rid/mesas"
              params={{ rid }}
              className="p-2 -ml-2 rounded-full hover:bg-muted"
            >
              <ArrowLeft className="size-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold leading-none">Mesa {table?.label}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {sid ? `Consumo: ${brl(consumed)}` : "Sem conta aberta"}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {sid && table?.status !== "aguardando_pagamento" && (
              <Button variant="outline" size="sm" onClick={requestBill} className="h-9 px-3">
                <Receipt className="size-4 mr-1" /> Conta
              </Button>
            )}
            {sid && mgr && (
              <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 px-3">
                    Fechar
                  </Button>
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
        <div className="relative">
          <Search className="absolute left-4 top-3.5 size-6 text-muted-foreground" />
          <Input
            placeholder="Digite o nome do produto..."
            className="pl-12 h-14 text-lg rounded-xl bg-muted/50 border-transparent focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      <div className="mt-4 space-y-6">
        {/* RESULTADOS DA BUSCA */}
        {search.trim().length > 0 && (
          <div className="space-y-2 animate-in fade-in">
            {searchResults.map((p) => (
              <button
                key={p.id}
                disabled={!p.available}
                onClick={() => add(p)}
                className="w-full card-surface flex items-center justify-between p-4 text-left active:scale-[0.98] transition-transform disabled:opacity-40 border-l-4 border-l-primary"
              >
                <div>
                  <div className="font-bold text-lg">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{p.categoryName}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-primary text-lg">{brl(p.price)}</span>
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Plus className="size-6 text-primary" />
                  </div>
                </div>
              </button>
            ))}
            {searchResults.length === 0 && (
              <div className="text-center py-10">
                <p className="text-muted-foreground text-lg">Nenhum produto encontrado.</p>
                <p className="text-sm text-muted-foreground">Tente buscar por outro nome.</p>
              </div>
            )}
          </div>
        )}

        {/* ESTADO VAZIO INICIAL (Só aparece quando não há busca nem pedidos) */}
        {!search.trim() && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
            <Search className="size-16 mb-4" />
            <p className="text-lg">Digite acima para buscar produtos</p>
          </div>
        )}

        {/* PEDIDOS JÁ FEITOS (Histórico) */}
        {orders.length > 0 && !search.trim() && (
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Pedidos desta conta
            </h2>
            <div className="grid gap-3">
              {orders.map((o) => (
                <OrderCard key={o.id} o={o} role={role} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTÃO FLUTUANTE DO CARRINHO */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-40 animate-in slide-in-from-bottom-full">
          <Button
            className="w-full h-14 text-lg rounded-xl flex justify-between px-6 shadow-xl"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-6" />
              <span>{cart.reduce((s, l) => s + l.quantity, 0)} itens</span>
            </div>
            <span>{brl(total)}</span>
          </Button>
        </div>
      )}

      {/* MODAL DO CARRINHO */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="sm:max-w-md h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="text-xl">Novo Pedido - Mesa {table?.label}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.map((l, i) => (
              <div key={l.product_id} className="space-y-2 border-b pb-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-base">{l.name}</span>
                  <span className="font-semibold">{brl(l.price * l.quantity)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 bg-muted p-1 rounded-lg">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-md bg-background shadow-sm"
                      onClick={() => upd(i, { quantity: l.quantity - 1 })}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-6 text-center font-bold text-lg">{l.quantity}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 rounded-md bg-background shadow-sm"
                      onClick={() => upd(i, { quantity: l.quantity + 1 })}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground">{brl(l.price)} un.</span>
                </div>

                <Input
                  placeholder="Observação (ex: sem cebola)"
                  value={l.notes}
                  onChange={(e) => upd(i, { notes: e.target.value })}
                  className="h-10 text-sm bg-muted/50"
                />
              </div>
            ))}

            <div className="pt-2">
              <Label className="mb-2 block text-sm">Observação geral do pedido</Label>
              <Textarea
                placeholder="Ex: Trazer tudo junto, mesa com pressa..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-background flex-col sm:flex-col gap-3">
            <div className="flex justify-between items-center w-full font-bold text-xl">
              <span>Total</span>
              <span>{brl(total)}</span>
            </div>
            <Button
              className="w-full h-14 text-lg rounded-xl"
              size="lg"
              disabled={busy}
              onClick={send}
            >
              <Send className="mr-2 size-5" /> Enviar para a cozinha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DO CUPOM */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Conta Encerrada!</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto bg-white p-2">
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
