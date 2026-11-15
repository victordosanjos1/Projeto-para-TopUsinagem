import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/app/components/app-shell";
import { date, money, quoteNumber, statusLabel } from "@/lib/format";
import { cancelQuote, duplicateQuote } from "../actions";

type Params = { q?: string; cliente?: string; status?: string; periodo?: string; de?: string; ate?: string; base?: string; deleted?: string; error?: string };
type Row = { id: string; quote_number: number | null; quote_year: number; revision: number; status: string; total: number; created_at: string; finalized_at: string | null; clients: { company_name: string } };

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const STATUS = ["draft", "sent", "send_failed", "cancelled", "deleted"];

export default async function List({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams, s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");
  const { data: clients } = await s.from("clients").select("id,company_name").order("company_name");

  const status = STATUS.includes(p.status ?? "") ? p.status! : "";
  const dateColumn = p.base === "envio" ? "finalized_at" : "created_at";
  let query = s.from("quotes")
    .select("id,quote_number,quote_year,revision,status,total,created_at,finalized_at,clients!inner(company_name)")
    .order(dateColumn, { ascending: false, nullsFirst: false }).limit(300);
  query = status ? query.eq("status", status) : query.neq("status", "deleted");
  if (p.cliente) query = query.eq("client_id", p.cliente);

  // Número: "3", "03" ou "03/2026". Qualquer outro texto procura no nome do cliente.
  const term = (p.q ?? "").trim();
  const number = term.match(/^0*(\d{1,4})(?:\s*\/\s*(\d{4}))?$/);
  if (number) {
    query = query.eq("quote_number", Number(number[1]));
    if (number[2]) query = query.eq("quote_year", Number(number[2]));
  } else if (term) {
    query = query.ilike("clients.company_name", `%${term.replace(/[%*\\]/g, "")}%`);
  }

  // Período: datas personalizadas têm prioridade sobre os atalhos de 30/60/90 dias.
  const from = p.de ? `${p.de}T00:00:00-03:00` : Number(p.periodo) ? daysAgo(Number(p.periodo)) : null;
  const to = p.ate ? `${p.ate}T23:59:59-03:00` : null;
  if (from) query = query.gte(dateColumn, from);
  if (to) query = query.lte(dateColumn, to);

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const filtered = Boolean(term || p.cliente || status || from || to);
  const count = (st: string) => rows.filter(q => q.status === st).length;

  return (
    <AppShell title="Orçamentos">
      <div className="page-heading">
        <div><h1>Orçamentos</h1><p>Encontre documentos pelo cliente, número, situação ou período.</p></div>
        <Link className="primary-action" href="/orcamentos">+ Novo orçamento</Link>
      </div>
      {p.deleted && <p className="notice success">Orçamento excluído. Para recuperar, filtre a situação “Excluído”.</p>}
      {(p.error || error) && <p className="notice error">{p.error ?? "Não foi possível carregar os orçamentos."}</p>}

      <article className="panel">
        <form className="filters">
          <label>Número ou cliente<input name="q" type="search" defaultValue={p.q} placeholder="Ex.: 03/2026 ou nome da empresa" /></label>
          <label>Cliente
            <select name="cliente" defaultValue={p.cliente ?? ""}>
              <option value="">Todos</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </label>
          <label>Situação
            <select name="status" defaultValue={status}>
              <option value="">Todas (menos excluídos)</option>
              {STATUS.map(st => <option key={st} value={st}>{statusLabel[st]}</option>)}
            </select>
          </label>
          <label>Data de
            <select name="base" defaultValue={p.base ?? "criacao"}>
              <option value="criacao">Criação</option>
              <option value="envio">Finalização/envio</option>
            </select>
          </label>
          <label>Período
            <select name="periodo" defaultValue={p.periodo ?? ""}>
              <option value="">Todo período</option>
              <option value="30">Últimos 30 dias</option>
              <option value="60">Últimos 60 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
          </label>
          <label>De<input name="de" type="date" defaultValue={p.de} /></label>
          <label>Até<input name="ate" type="date" defaultValue={p.ate} /></label>
          <div className="filter-buttons">
            <button className="primary-action">Filtrar</button>
            {filtered && <Link className="secondary-action" href="/orcamentos/lista">Limpar</Link>}
          </div>
        </form>

        <div className="filter-summary">
          <span><strong>{rows.length}</strong> {rows.length === 1 ? "orçamento" : "orçamentos"}</span>
          {!status && <><span><strong>{count("draft")}</strong> rascunhos</span><span><strong>{count("sent")}</strong> enviados</span><span><strong>{count("send_failed")}</strong> com falha</span><span><strong>{count("cancelled")}</strong> cancelados</span></>}
          {rows.length === 300 && <span className="muted">Mostrando os 300 mais recentes. Use os filtros para refinar.</span>}
        </div>

        <div className="table-scroll">
          <table>
            <thead><tr><th>Número</th><th>Cliente</th><th>Criado</th><th>Enviado</th><th className="num">Valor orçado</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {rows.map(q => (
                <tr key={q.id}>
                  <td className="nowrap"><Link className="row-link" href={`/orcamentos/${q.id}`}>{quoteNumber(q)}</Link></td>
                  <td>{q.clients?.company_name}</td>
                  <td className="nowrap">{date(q.created_at)}</td>
                  <td className="nowrap">{q.finalized_at ? date(q.finalized_at) : "—"}</td>
                  <td className="num nowrap">{money(q.total)}</td>
                  <td><span className={`badge ${q.status}`}>{statusLabel[q.status]}</span></td>
                  <td>
                    <details className="quote-actions">
                      <summary aria-label="Ações do orçamento">⋮</summary>
                      <div>
                        <Link href={`/orcamentos/${q.id}`}>Abrir</Link>
                        {q.status === "draft" && <Link href={`/orcamentos/${q.id}/editar`}>Editar</Link>}
                        {q.status !== "deleted" && <form action={duplicateQuote}><input type="hidden" name="id" value={q.id} /><button>Duplicar</button></form>}
                        {["draft", "sent", "send_failed"].includes(q.status) && <form action={cancelQuote}><input type="hidden" name="id" value={q.id} /><button className="danger-link">Cancelar</button></form>}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">
            {filtered ? "Nenhum orçamento encontrado com estes filtros." : <>Ainda não há orçamentos. <Link className="back" href="/orcamentos">Criar o primeiro →</Link></>}
          </div>
        )}
      </article>
    </AppShell>
  );
}
