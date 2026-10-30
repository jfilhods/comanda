import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChefHat,
  ClipboardList,
  Building2,
  ArrowRight,
  Smartphone,
  Zap,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  LayoutDashboard,
  UtensilsCrossed,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Comanda — Gestão inteligente para restaurantes" },
      {
        name: "description",
        content:
          "Sistema completo para gestão de restaurantes. Do lançamento do pedido na mesa até a cozinha, com controle de equipe, mesas e faturamento.",
      },
      { property: "og:title", content: "Comanda — Pedidos do salão à cozinha" },
      {
        property: "og:description",
        content: "Garçom lança, a cozinha vê na hora, o gerente fecha a conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-ink text-ink-foreground selection:bg-accent selection:text-accent-foreground">
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight">
            comanda<span className="text-accent">.</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#como-funciona"
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              Como funciona
            </a>
            <a
              href="#vantagens"
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              Vantagens
            </a>
            <a
              href="#para-quem"
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              Para quem é
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-white/70 hover:text-white sm:inline-flex"
            >
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="font-semibold">
              <Link to="/auth">Acessar sistema</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden">
          {/* fundo sutil */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(var(--accent-rgb,234,88,12),0.15),transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_60%,rgb(var(--ink)/1))]"
          />

          <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-white/70">
                <span className="flex size-1.5 rounded-full bg-accent shadow-[0_0_8px_currentColor]" />
                Plataforma multiempresa para restaurantes
              </div>

              <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.25rem]">
                Do salão à cozinha, <span className="text-accent">sem papel e sem atraso.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
                O Comanda conecta garçom, cozinha e gerência em tempo real. Pedidos chegam na tela
                na hora, a equipe trabalha com clareza e você fecha o dia com controle total.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 min-w-[180px] px-6 text-base font-semibold"
                >
                  <Link to="/auth">
                    Começar agora
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 min-w-[180px] border-white/15 bg-transparent px-6 text-base text-white hover:bg-white/5"
                >
                  <a href="#como-funciona">Ver como funciona</a>
                </Button>
              </div>

              {/* prova social / números */}
              <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-white/[0.06] pt-10 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-accent" />
                  Pedidos em tempo real
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-accent" />
                  Acesso por PIN para a equipe
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-accent" />
                  Dados isolados por empresa
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── COMO FUNCIONA ─── */}
        <section
          id="como-funciona"
          className="scroll-mt-20 border-t border-white/[0.06] bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">
                Fluxo operacional
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                Três visões. Um único fluxo.
              </h2>
              <p className="mt-4 text-white/55">
                Cada perfil vê exatamente o que precisa — sem ruído, sem distração.
              </p>
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-3">
              {[
                {
                  icon: ClipboardList,
                  title: "Garçom",
                  subtitle: "Salão",
                  description:
                    "Abre a mesa, lança itens com observações, acompanha o preparo e solicita o fechamento com um toque.",
                  features: ["Cardápio digital", "Lançamento rápido", "Divisão de conta"],
                },
                {
                  icon: ChefHat,
                  title: "Cozinha",
                  subtitle: "Produção",
                  description:
                    "Tela focada no preparo. Pedidos em tempo real, organizados por status, com alerta sonoro.",
                  features: ["Alerta sonoro", "Fila visual", "Aviso de pronto"],
                },
                {
                  icon: Building2,
                  title: "Gerência",
                  subtitle: "Controle",
                  description:
                    "Equipe com PIN, cardápio, mesas e relatórios de faturamento em um só painel.",
                  features: ["Faturamento", "Formas de pagamento", "Gestão de mesas"],
                },
              ].map(({ icon: Icon, title, subtitle, description, features }) => (
                <article
                  key={title}
                  className="group relative flex flex-col rounded-2xl border border-white/[0.08] bg-ink p-8 transition-colors hover:border-accent/30"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
                      <Icon className="size-6" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider text-white/35">
                      {subtitle}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-white/55">{description}</p>

                  <ul className="mt-6 space-y-2 border-t border-white/[0.06] pt-6">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                        <CheckCircle2 className="size-3.5 shrink-0 text-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── VANTAGENS ─── */}
        <section id="vantagens" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-accent">
                  Por que Comanda
                </p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                  Feito para o ritmo do restaurante, não para planilhas.
                </h2>
                <p className="mt-5 text-white/55 leading-relaxed">
                  Menos erro de pedido, mais velocidade no salão e visão clara do que está saindo —
                  e do que está entrando.
                </p>
                <Button asChild className="mt-8 font-semibold">
                  <Link to="/auth">
                    Acessar o sistema
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  {
                    icon: Clock,
                    title: "Menos erros",
                    text: "Sem caderno, sem letra ilegível. O pedido vai direto para a tela da cozinha.",
                  },
                  {
                    icon: TrendingUp,
                    title: "Mais agilidade",
                    text: "Garçom atende mais mesas. Cliente recebe mais rápido.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Seguro e isolado",
                    text: "Cada empresa em seu espaço (RLS). Dados protegidos de ponta a ponta.",
                  },
                  {
                    icon: Smartphone,
                    title: "No celular ou tablet",
                    text: "Interface responsiva. A equipe trabalha de onde estiver no salão.",
                  },
                ].map(({ icon: Icon, title, text }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
                  >
                    <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── PARA QUEM ─── */}
        <section
          id="para-quem"
          className="scroll-mt-20 border-t border-white/[0.06] bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">
                Para quem é
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                Do bar de bairro à rede de filiais
              </h2>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: UtensilsCrossed, label: "Restaurantes" },
                { icon: Users, label: "Bares e pubs" },
                { icon: LayoutDashboard, label: "Redes e franquias" },
                { icon: BarChart3, label: "Food courts" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.06] bg-ink px-6 py-8 text-center"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-white/[0.04] text-accent">
                    <Icon className="size-5" />
                  </div>
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL ─── */}
        <section className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-accent/10 via-white/[0.02] to-transparent px-8 py-16 text-center md:px-16">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-accent/10 blur-3xl"
              />
              <h2 className="relative font-display text-3xl font-bold tracking-tight md:text-4xl">
                Pronto para modernizar o seu salão?
              </h2>
              <p className="relative mx-auto mt-4 max-w-md text-white/55">
                Acesso em menos de um minuto. Gerente, cozinha e equipe no mesmo fluxo.
              </p>
              <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-8 font-semibold">
                  <Link to="/auth">
                    Fazer login no sistema
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <span className="font-display text-lg font-extrabold tracking-tight">
              comanda<span className="text-accent">.</span>
            </span>
            <p className="text-xs text-white/40">Gestão de pedidos para restaurantes</p>
          </div>

          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} Comanda. Todos os direitos reservados.
          </p>

          <Link
            to="/auth"
            className="text-xs font-medium text-white/45 transition-colors hover:text-white"
          >
            Acesso restrito
          </Link>
        </div>
      </footer>
    </div>
  );
}
