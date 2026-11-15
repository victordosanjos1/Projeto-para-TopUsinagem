import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/app/components/app-shell";
import { date, money, quoteNumber, statusLabel } from "@/lib/format";

type Quote = { id: string; client_id: string; quote_number: number | null; quote_year: number; revision: number; status: string; total: number; created_at: string; finalized_at: string | null; clients: { company_name: string } | null };

const PERIODS: Record<string, string> = { "30": "Últimos 30 dias", "60": "Últimos 60 dias", "90": "Últimos 90 dias", all: "Todo período" };
const sinceDays = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const p = await searchParams, s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");
  const period = p.periodo && PERIODS[p.periodo] ? p.periodo : "30";

  // Documentos numerados (inclui cancelados para saber se a última revisão foi cancelada).
  let numbered = s.from("quotes").select("id,client_id,quote_number,quote_year,revision,status,total,created_at,finalized_at,clients(company_name)")
    .not("quote_number", "is", null).in("status", ["sent", "send_failed", "cancelled"]);
  if (period !== "all") numbered = numbered.gte("finalized_at", sinceDays(Number(period)));
  const [{ data: finalized }, { data: recent }, { count: drafts }, { count: failed }] = await Promise.all([
    numbered,
    s.from("quotes").select("id,client_id,quote_number,quote_year,revision,status,total,created_at,finalized_at,clients(company_name)").neq("status", "deleted").order("created_at", { ascending: false }).limit(8),
    s.from("quotes").select("id", { count: "exact", head: true }).eq("status", "draft"),
    s.from("quotes").select("id", { count: "exact", head: true }).eq("status", "send_failed"),
  ]);

  // Valor orçado = última revisão finalizada de cada número, só se estiver enviada ou com falha de envio.
  const latest = new Map<string, Quote>();
  for (const q of (finalized ?? []) as unknown as Quote[]) {
    const key = `${q.client_id}:${q.quote_year}:${q.quote_number}`;
    if (!latest.has(key) || latest.get(key)!.revision < q.revision) latest.set(key, q);
  }
  const counted = [...latest.values()].filter(q => q.status === "sent" || q.status === "send_failed");
  const total = counted.reduce((sum, q) => sum + Number(q.total), 0);
  const rows = (recent ?? []) as unknown as Quote[];

  return (
    <AppShell title="Painel">
      <div className="page-heading">
        <div><h1>{greeting()}!</h1><p>Visão geral dos orçamentos da TOP Usinagem.</p></div>
        <Link className="primary-action" href="/orcamentos">+ Novo orçamento</Link>
      </div>
      <nav className="tabs" aria-label="Período">
        {Object.entries(PERIODS).map(([value, label]) => <Link key={value} className={period === value ? "active" : ""} href={`/dashboard?periodo=${value}`}>{label}</Link>)}
      </nav>
      <div className="metrics">
        <article><span>ORÇAMENTOS ENVIADOS</span><strong>{counted.length}</strong><small>{PERIODS[period].toLowerCase()}</small></article>
        <article><span>VALOR ORÇADO</span><strong>{money(total)}</strong><small>não é faturamento</small></article>
        <article><span>RASCUNHOS</span><strong>{drafts ?? 0}</strong><small><Link href="/orcamentos/lista?status=draft">ver rascunhos</Link></small></article>
        <article className={failed ? "attention" : ""}><span>AGUARDANDO REENVIO</span><strong>{failed ?? 0}</strong><small>{failed ? <Link href="/orcamentos/lista?status=send_failed">resolver agora</Link> : "nenhuma falha"}</small></article>
      </div>
      <article className="panel">
        <div className="section-label"><h2>Orçamentos recentes</h2><Link className="back" href="/orcamentos/lista">Ver todos →</Link></div>
        {rows.length ? (
          <div className="table-scroll"><table>
            <thead><tr><th>Número</th><th>Cliente</th><th>Criado</th><th className="num">Total</th><th>Situação</th></tr></thead>
            <tbody>{rows.map(q => <tr key={q.id}><td className="nowrap"><Link className="row-link" href={`/orcamentos/${q.id}`}>{quoteNumber(q)}</Link></td><td>{q.clients?.company_name}</td><td className="nowrap">{date(q.created_at)}</td><td className="num nowrap">{money(q.total)}</td><td><span className={`badge ${q.status}`}>{statusLabel[q.status]}</span></td></tr>)}</tbody>
          </table></div>
        ) : <p className="empty">Ainda não há orçamentos. <Link className="back" href="/orcamentos">Criar o primeiro →</Link></p>}
      </article>
    </AppShell>
  );
}
