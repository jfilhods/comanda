import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Store, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
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
import { useMe } from "@/lib/session";
import { createStaff } from "@/lib/staff.functions";
import { isValidDocument, maskDocument, maskPhone, onlyDigits } from "@/lib/validators";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin global — Comanda" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { data: me } = useMe();
  const [phone, setPhone] = useState("");
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    enabled: !!me?.isAdmin,
    queryFn: async () =>
      (
        await supabase
          .from("companies")
          .select("*, restaurants(id, name, status)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const toggle = useMutation({
    mutationFn: async (c: { id: string; status: string }) => {
      const { error } = await supabase
        .from("companies")
        .update({ status: c.status === "ativa" ? "suspensa" : "ativa" })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });

  if (me && !me.isAdmin)
    return (
      <div className="min-h-screen">
        <AppHeader />
        <p className="p-10 text-muted-foreground">Acesso restrito ao administrador global.</p>
      </div>
    );

  const term = q.toLowerCase();
  const filtered = companies.filter((c) =>
    [c.legal_name, c.trade_name, c.cnpj, c.email, c.contact_name].some((v) =>
      v?.toLowerCase().includes(term),
    ),
  );

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Empresas</h1>
            <p className="text-muted-foreground">{companies.length} cadastradas na plataforma</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nome, CNPJ, e-mail…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <CompanyDialog />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filtered.map((c) => (
            <div key={c.id} className="card-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{c.trade_name || c.legal_name}</h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.status === "ativa" ? "bg-st-pronto/15 text-st-pronto" : "bg-st-cancel/15 text-st-cancel"}`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.legal_name} {c.cnpj && `· ${c.cnpj}`}{" "}
                    {c.contact_name && `· ${c.contact_name}`} {c.email && `· ${c.email}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <RestaurantDialog companyId={c.id} />
                  <Button variant="outline" size="sm" onClick={() => toggle.mutate(c)}>
                    {c.status === "ativa" ? "Suspender" : "Reativar"}
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {c.restaurants?.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg border bg-background p-3"
                  >
                    <Store className="size-4 text-primary" />
                    <Link
                      to="/r/$rid"
                      params={{ rid: r.id }}
                      className="flex-1 font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                    <ManagerDialog restaurantId={r.id} restaurantName={r.name} />
                  </div>
                ))}
                {!c.restaurants?.length && (
                  <p className="text-sm text-muted-foreground">Sem restaurantes.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function CompanyDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // estados controlados para campos mascarados
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [docError, setDocError] = useState<string | null>(null);

  function resetForm() {
    setPhone("");
    setDocument("");
    setDocError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // validação do CPF/CNPJ apenas se foi preenchido
    if (document && !isValidDocument(document)) {
      setDocError("CPF/CNPJ inválido");
      toast.error("CPF/CNPJ inválido");
      return;
    }
    setDocError(null);

    const fd = new FormData(e.currentTarget);
    const f = (k: string) => String(fd.get(k) ?? "");

    const { data, error } = await supabase
      .from("companies")
      .insert({
        legal_name: f("legal_name"),
        trade_name: f("trade_name") || null,
        cnpj: document ? onlyDigits(document) : null, // guarda só dígitos no banco
        contact_name: f("contact_name") || null,
        email: f("email") || null,
        phone: phone ? onlyDigits(phone) : null, // guarda só dígitos no banco
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    if (f("restaurant"))
      await supabase.from("restaurants").insert({ company_id: data.id, name: f("restaurant") });

    toast.success("Empresa cadastrada");
    qc.invalidateQueries({ queryKey: ["companies"] });
    setOpen(false);
    resetForm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nova empresa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Field name="legal_name" label="Razão social" required />
          <Field name="trade_name" label="Nome fantasia" />

          <div className="grid grid-cols-2 gap-3">
            {/* CPF/CNPJ */}
            <div className="space-y-1.5">
              <Label htmlFor="document">CPF/CNPJ</Label>
              <Input
                id="document"
                name="document"
                inputMode="numeric"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={document}
                onChange={(e) => {
                  setDocument(maskDocument(e.target.value));
                  if (docError) setDocError(null);
                }}
                aria-invalid={!!docError}
              />
              {docError && <p className="text-xs text-destructive">{docError}</p>}
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                name="phone"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
            </div>
          </div>

          <Field name="contact_name" label="Responsável" />
          <Field name="email" label="E-mail" type="email" />
          <Field name="restaurant" label="Primeiro restaurante (opcional)" />
          <Button type="submit">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RestaurantDialog({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f = (k: string) => String(fd.get(k) ?? "");
    const { error } = await supabase.from("restaurants").insert({
      company_id: companyId,
      name: f("name"),
      phone: f("phone") || null,
      address: f("address") || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["companies"] });
    setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus /> Restaurante
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo restaurante</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Field name="name" label="Nome" required />
          <Field name="phone" label="Telefone" />
          <Field name="address" label="Endereço" />
          <Button type="submit">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ManagerDialog({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const [open, setOpen] = useState(false);
  const create = useServerFn(createStaff);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const f = (k: string) => String(fd.get(k) ?? "");
    try {
      await create({
        data: {
          restaurantId,
          fullName: f("name"),
          email: f("email"),
          password: f("password"),
          role: "gerente",
        },
      });
      toast.success("Gerente cadastrado");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Adicionar gerente">
          <UserPlus />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerente de {restaurantName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Field name="name" label="Nome completo" required />
          <Field name="email" label="E-mail" type="email" required />
          <Field
            name="password"
            label="Senha inicial (mín. 8)"
            type="password"
            required
            minLength={8}
          />
          <Button type="submit">Cadastrar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  label,
  name,
  ...rest
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...rest} />
    </div>
  );
}
