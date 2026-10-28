import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { brl } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/r/$rid/cardapio")({
  head: () => ({ meta: [{ title: "Cardápio — Comanda" }] }),
  component: MenuPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  active: boolean;
  position: number;
};

function MenuPage() {
  const { rid } = Route.useParams();
  const qc = useQueryClient();
  const key = ["menu-admin", rid];
  const { data: cats = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await supabase
          .from("categories")
          .select("*, products(*)")
          .eq("restaurant_id", rid)
          .order("position")
      ).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["menu", rid] });
  };

  // ---------- Categoria ----------
  async function addCat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    const { error } = await supabase
      .from("categories")
      .insert({ restaurant_id: rid, name, position: cats.length });
    if (error) {
      toast.error(error.message);
      return;
    }
    form.reset();
    refresh();
    toast.success(`Categoria "${name}" adicionada`);
  }

  async function deleteCat(id: string, name: string) {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error(`Não foi possível excluir: ${error.message}`);
      return;
    }
    refresh();
    toast.success(`Categoria "${name}" excluída`);
  }

  async function patchCat(id: string, patch: { active: boolean }) {
    const { error } = await supabase.from("categories").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success(patch.active ? "Categoria ativada" : "Categoria desativada");
  }

  // ---------- Produto ----------
  async function addProduct(e: React.FormEvent<HTMLFormElement>, category_id: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name") ?? "").trim();
    const price = Number(String(f.get("price")).replace(",", "."));
    if (!name) {
      toast.error("Informe o nome do produto");
      return;
    }
    if (!(price >= 0)) {
      toast.error("Preço inválido");
      return;
    }
    const { error } = await supabase.from("products").insert({
      restaurant_id: rid,
      category_id,
      name,
      description: String(f.get("description") ?? "") || null,
      price,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    form.reset();
    refresh();
    toast.success(`"${name}" adicionado ao cardápio`);
  }

  async function patchProduct(id: string, patch: Record<string, unknown>, msg?: string) {
    const { error } = await supabase
      .from("products")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    if (msg) toast.success(msg);
  }

  async function deleteProduct(id: string, name: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error(`Não foi possível excluir: ${error.message}`);
      return;
    }
    refresh();
    toast.success(`"${name}" excluído`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Cardápio</h1>
        <form onSubmit={addCat} className="flex gap-2">
          <Input name="name" placeholder="Nova categoria (ex.: Bebidas)" required />
          <Button type="submit">
            <Plus /> Categoria
          </Button>
        </form>
      </div>

      {cats.map((c) => (
        <section key={c.id} className="card-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{c.name}</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                Ativa{" "}
                <Switch checked={c.active} onCheckedChange={(v) => patchCat(c.id, { active: v })} />
              </label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Excluir categoria">
                    <Trash2 className="text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir categoria "{c.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os produtos desta categoria serão desvinculados (category_id vira nulo), mas
                      não apagados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteCat(c.id, c.name)}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="mt-3 divide-y">
            {c.products
              .slice()
              .sort((a: Product, b: Product) => a.position - b.position)
              .map((p: Product) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  onPatch={patchProduct}
                  onDelete={deleteProduct}
                />
              ))}
            {!c.products.length && (
              <p className="py-2 text-sm text-muted-foreground">Sem produtos ainda.</p>
            )}
          </div>

          <form onSubmit={(e) => addProduct(e, c.id)} className="mt-3 flex flex-wrap gap-2">
            <Input name="name" placeholder="Produto" required className="w-48" />
            <Input name="description" placeholder="Descrição" className="min-w-48 flex-1" />
            <Input name="price" placeholder="Preço" required className="w-28" inputMode="decimal" />
            <Button type="submit" variant="secondary">
              <Plus /> Produto
            </Button>
          </form>
        </section>
      ))}
    </div>
  );
}

// ---------- linha de produto com edição/exclusão ----------
function ProductRow({
  product,
  onPatch,
  onDelete,
}: {
  product: Product;
  onPatch: (id: string, patch: Record<string, unknown>, msg?: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(Number(product.price).toFixed(2));

  function openEdit() {
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(Number(product.price).toFixed(2));
    setEditOpen(true);
  }

  async function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = Number(price.replace(",", "."));
    if (!(p >= 0)) {
      toast.error("Preço inválido");
      return;
    }
    await onPatch(
      product.id,
      { name: name.trim(), description: description.trim() || null, price: p },
      `"${name.trim()}" atualizado`,
    );
    setEditOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <div className="min-w-48 flex-1">
        <div className="font-semibold">{product.name}</div>
        {product.description && (
          <div className="text-sm text-muted-foreground">{product.description}</div>
        )}
      </div>

      <span className="w-24 text-sm text-muted-foreground">{brl(product.price)}</span>

      <label className="flex items-center gap-2 text-sm">
        Disponível{" "}
        <Switch
          checked={product.available}
          onCheckedChange={(v) =>
            onPatch(product.id, { available: v }, v ? "Produto disponível" : "Produto indisponível")
          }
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        Ativo{" "}
        <Switch
          checked={product.active}
          onCheckedChange={(v) =>
            onPatch(product.id, { active: v }, v ? "Produto ativado" : "Produto desativado")
          }
        />
      </label>

      {/* Editar */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Editar produto" onClick={openEdit}>
            <Pencil />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar produto</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Descrição</Label>
              <Input
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Preço</Label>
              <Input
                id="edit-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <Button type="submit">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Excluir produto">
            <Trash2 className="text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{product.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Pedidos antigos mantêm o nome e preço do momento da
              compra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(product.id, product.name)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
