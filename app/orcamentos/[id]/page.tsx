import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { finalizeDraft } from "../actions";
import { AppShell } from "@/app/components/app-shell";
import { date, money, statusLabel } from "@/lib/format";
export default async function QuoteDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; sent?: string; error?: string }>;
}) {
  const { id } = await params,
    p = await searchParams,
    s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user) redirect("/");
  const { data: quote } = await s
    .from("quotes")
    .select(
      "*,clients(company_name,contact_name,cnpj,city,state,client_emails(email,is_primary)),quote_items(*),quote_delivery_log(*)",
    )
    .eq("id", id)
    .single();
  if (!quote) redirect("/orcamentos/lista");
  const emails = (
    (quote.clients?.client_emails ?? []) as {
      email: string;
      is_primary: boolean;
    }[]
  )
    .map((x) => x.email)
    .join("; ");
  const draft = ["draft", "send_failed"].includes(quote.status);
  return (
    <AppShell title="Detalhes do orçamento">
      <div className="page-heading">
        <div>
          <Link className="back" href="/orcamentos/lista">
            ← Voltar à lista
          </Link>
          <h1>
            Orçamento{" "}
            {quote.quote_number
              ? `${String(quote.quote_number).padStart(2, "0")}/${quote.quote_year}`
              : "rascunho"}
          </h1>
          <p>
            <span className={`badge ${quote.status}`}>
              {statusLabel[quote.status]}
            </span>{" "}
            · criado em {date(quote.created_at)}
          </p>
        </div>
        {quote.status !== "draft" && (
          <a className="secondary-action" href={`/api/orcamentos/${id}/pdf`}>
            Baixar PDF
          </a>
        )}
      </div>
      {p.saved && (
        <p className="notice success">
          Rascunho salvo. Confira os dados e finalize quando estiver pronto.
        </p>
      )}
      {p.sent && (
        <p className="notice success">
          Orçamento finalizado, PDF salvo e e-mail aceito para envio.
        </p>
      )}
      {p.error && <p className="notice error">{p.error}</p>}
      <div className="quote-detail">
        <main>
          <article className="panel">
            <h2>Cliente</h2>
            <strong>{quote.clients?.company_name}</strong>
            <p className="muted">
              {quote.clients?.contact_name} · {quote.clients?.cnpj}
              <br />
              {quote.clients?.city}/{quote.clients?.state}
            </p>
          </article>
          <article className="panel">
            <h2>Itens</h2>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Qtd.</th>
                  <th>Unitário</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {quote.quote_items.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unit_price)}</td>
                    <td>{money(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="total">Total: {money(quote.total)}</div>
          </article>
          <article className="panel">
            <h2>Histórico de envio</h2>
            {quote.quote_delivery_log?.length ? (
              <table>
                <tbody>
                  {quote.quote_delivery_log.map((log: any) => (
                    <tr key={log.id}>
                      <td>{log.recipient}</td>
                      <td>{log.status}</td>
                      <td>{date(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Ainda não houve tentativa de envio.</p>
            )}
          </article>
        </main>
        <aside>
          <article className="panel">
            <h2>Condições comerciais</h2>
            <p>
              Validade: <strong>{quote.validity_days} dias</strong>
            </p>
            <p>
              Entrega:{" "}
              <strong>
                {quote.delivery_to_agree
                  ? "A combinar"
                  : `${quote.delivery_days} dias úteis`}
              </strong>
            </p>
            <p>
              Frete:{" "}
              <strong>
                {quote.freight.toUpperCase()} · {money(quote.freight_amount)}
              </strong>
            </p>
            <p>
              Desconto: <strong>{money(quote.discount_value)}</strong>
            </p>
            <p>
              Pagamento: <strong>{quote.payment}</strong>
            </p>
          </article>
          {draft && (
            <article className="panel">
              <h2>Finalizar e enviar</h2>
              <p className="muted">
                O PDF será armazenado de forma privada e enviado aos
                destinatários.
              </p>
              <form action={finalizeDraft}>
                <input type="hidden" name="id" value={id} />
                <label>
                  Destinatários
                  <textarea name="recipients" required defaultValue={emails} />
                </label>
                <button className="primary-action">Finalizar e enviar</button>
              </form>
            </article>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
