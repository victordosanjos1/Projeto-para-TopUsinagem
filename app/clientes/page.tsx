import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCustomer, toggleCustomerStatus } from "./actions";
import { AppShell } from "@/app/components/app-shell";
import { ClientSearch } from "./client-search";
import { CustomerForm } from "./customer-form";
import { formatCnpj, onlyDigits } from "@/lib/br";

type Row = { id: string; company_name: string; contact_name: string; cnpj: string; city: string; state: string; is_active: boolean; client_emails: { email: string; is_primary: boolean }[] };

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; created?: string; error?: string }> }) {
  const p = await searchParams, s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");

  // Remove caracteres que têm significado especial no filtro do banco.
  const term = (p.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const status = p.status ?? "active";
  let query = s.from("clients").select("id,company_name,contact_name,cnpj,city,state,is_active,client_emails(email,is_primary)").order("company_name");
  if (status !== "all") query = query.eq("is_active", status === "active");
  if (term) {
    const digits = onlyDigits(term);
    const { data: byEmail } = await s.from("client_emails").select("client_id").ilike("email", `%${term}%`).limit(200);
    const filters = [`company_name.ilike.%${term}%`, `contact_name.ilike.%${term}%`];
    if (digits.length >= 2) filters.push(`cnpj.ilike.%${digits}%`);
    const ids = [...new Set((byEmail ?? []).map(e => e.client_id))];
    if (ids.length) filters.push(`id.in.(${ids.join(",")})`);
    query = query.or(filters.join(","));
  }
  const { data } = await query;
  const clients = (data ?? []) as Row[];
  const tabs = [["active", "Ativos"], ["inactive", "Inativos"], ["all", "Todos"]];

  return (
    <AppShell title="Clientes">
      <div className="page-heading">
        <div><h1>Clientes</h1><p>Cadastre, pesquise e mantenha os contatos comerciais.</p></div>
      </div>
      {p.created && <p className="notice success">Cliente salvo com sucesso.</p>}
      {p.error && <p className="notice error">{p.error}</p>}
      <div className="clients-grid">
        <article className="panel">
          <div className="search">
            <ClientSearch initial={p.q} status={status} />
          </div>
          <nav className="tabs" aria-label="Situação">
            {tabs.map(([value, label]) => (
              <Link key={value} className={status === value ? "active" : ""} href={`/clientes?status=${value}${p.q ? `&q=${encodeURIComponent(p.q)}` : ""}`}>{label}</Link>
            ))}
            <span className="muted">{clients.length} {clients.length === 1 ? "cliente" : "clientes"}</span>
          </nav>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Empresa</th><th>Responsável</th><th>CNPJ</th><th>E-mail principal</th><th>Situação</th><th></th></tr></thead>
              <tbody>
                {clients.map(c => {
                  const email = c.client_emails.find(x => x.is_primary)?.email ?? c.client_emails[0]?.email;
                  return (
                    <tr key={c.id}>
                      <td><Link className="row-link" href={`/clientes/${c.id}`}>{c.company_name}</Link><br /><small className="muted">{c.city}/{c.state}</small></td>
                      <td>{c.contact_name}</td>
                      <td className="nowrap">{formatCnpj(c.cnpj)}</td>
                      <td>{email}{c.client_emails.length > 1 && <small className="muted"> +{c.client_emails.length - 1}</small>}</td>
                      <td><span className={`badge ${c.is_active ? "sent" : "cancelled"}`}>{c.is_active ? "Ativo" : "Inativo"}</span></td>
                      <td className="row-actions">
                        <Link className="text-button" href={`/clientes/${c.id}`}>Editar</Link>
                        <form action={toggleCustomerStatus}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="active" value={String(c.is_active)} />
                          <input type="hidden" name="back" value={`/clientes?status=${status}${p.q ? `&q=${encodeURIComponent(p.q)}` : ""}`} />
                          <button className="text-button">{c.is_active ? "Inativar" : "Ativar"}</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!clients.length && <div className="empty">{term ? `Nenhum cliente encontrado para “${p.q}”.` : "Nenhum cliente nesta lista ainda."}</div>}
        </article>
        <article className="panel" id="novo">
          <h2>Novo cliente</h2>
          <CustomerForm action={createCustomer} submitLabel="Salvar cliente" />
        </article>
      </div>
    </AppShell>
  );
}
