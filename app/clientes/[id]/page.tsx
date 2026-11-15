import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/app/components/app-shell";
import { CustomerForm } from "../customer-form";
import { toggleCustomerStatus, updateCustomer } from "../actions";
import { date, money, quoteNumber, statusLabel } from "@/lib/format";

type Email = { email: string; is_primary: boolean };
type Quote = { id: string; quote_number: number | null; quote_year: number; revision: number; status: string; total: number; created_at: string };

export default async function EditCustomer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { id } = await params, p = await searchParams, s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");
  const { data: c } = await s.from("clients").select("*,client_emails(email,is_primary)").eq("id", id).single();
  if (!c) redirect("/clientes");
  const { data: quotes } = await s.from("quotes").select("id,quote_number,quote_year,revision,status,total,created_at").eq("client_id", id).neq("status", "deleted").order("created_at", { ascending: false }).limit(10);
  const emails = ((c.client_emails ?? []) as Email[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map(e => e.email);

  return (
    <AppShell title="Cliente">
      <div className="page-heading">
        <div>
          <Link className="back" href="/clientes">← Voltar aos clientes</Link>
          <h1>{c.company_name}</h1>
          <p><span className={`badge ${c.is_active ? "sent" : "cancelled"}`}>{c.is_active ? "Ativo" : "Inativo"}</span> · cadastrado em {date(c.created_at)}</p>
        </div>
        <div className="detail-actions">
          {c.is_active && <Link className="primary-action" href={`/orcamentos?cliente=${id}`}>+ Novo orçamento</Link>}
          <form action={toggleCustomerStatus}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="active" value={String(c.is_active)} />
            <input type="hidden" name="back" value={`/clientes/${id}`} />
            <button className="secondary-action">{c.is_active ? "Inativar" : "Ativar"}</button>
          </form>
        </div>
      </div>
      {p.saved && <p className="notice success">Cliente atualizado.</p>}
      {p.error && <p className="notice error">{p.error}</p>}
      <div className="clients-grid">
        <article className="panel">
          <h2>Dados do cliente</h2>
          <CustomerForm action={updateCustomer} submitLabel="Salvar alterações" customer={{ ...c, emails }} />
          <p className="muted"><small>Orçamentos já enviados guardam os dados da época e não mudam com esta edição.</small></p>
        </article>
        <article className="panel">
          <h2>Últimos orçamentos</h2>
          {quotes?.length ? (
            <div className="table-scroll"><table>
              <thead><tr><th>Número</th><th>Data</th><th className="num">Total</th><th>Situação</th></tr></thead>
              <tbody>{(quotes as Quote[]).map(q => <tr key={q.id}><td><Link className="row-link" href={`/orcamentos/${q.id}`}>{quoteNumber(q)}</Link></td><td>{date(q.created_at)}</td><td className="num nowrap">{money(q.total)}</td><td><span className={`badge ${q.status}`}>{statusLabel[q.status]}</span></td></tr>)}</tbody>
            </table></div>
          ) : <p className="empty">Nenhum orçamento para este cliente ainda.</p>}
        </article>
      </div>
    </AppShell>
  );
}
