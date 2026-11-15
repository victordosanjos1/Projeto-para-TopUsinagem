import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cancelQuote, createRevision, deleteQuote, duplicateQuote, finalizeDraft, restoreQuote } from "../actions";
import { AppShell } from "@/app/components/app-shell";
import { date, dateTime, deliveryLogLabel, deliveryText, discountText, freightLabel, money, paymentLabel, quoteLabel, statusLabel, validityText } from "@/lib/format";

type Item = { id: string; position: number; description: string; quantity: number; unit_price: number; subtotal: number };
type Log = { id: string; recipient: string; status: string; error_message: string | null; created_at: string };
type Email = { email: string; is_primary: boolean };

const notices: Record<string, string> = {
  saved: "Rascunho salvo. Confira os dados e finalize quando estiver pronto.",
  sent: "Orçamento finalizado, PDF salvo e e-mail aceito pelo provedor para envio.",
  cancelled: "Orçamento cancelado e preservado no histórico.",
  restored: "Orçamento restaurado.",
};

function ActionButton({ action, id, label, className = "secondary-action" }: { action: (f: FormData) => Promise<void>; id: string; label: string; className?: string }) {
  return <form action={action}><input type="hidden" name="id" value={id} /><button className={className}>{label}</button></form>;
}

export default async function QuoteDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params, p = await searchParams, s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");
  const { data: quote } = await s.from("quotes")
    .select("*,clients(company_name,contact_name,cnpj,city,state,client_emails(email,is_primary)),quote_items(*),quote_delivery_log(*)")
    .eq("id", id).single();
  if (!quote) redirect("/orcamentos/lista");

  // Depois de finalizado, o documento mostra os dados congelados do cliente.
  const client = quote.customer_snapshot ?? quote.clients;
  const emails = ((quote.clients?.client_emails ?? []) as Email[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map(e => e.email);
  const items = ((quote.quote_items ?? []) as Item[]).sort((a, b) => a.position - b.position);
  const logs = ((quote.quote_delivery_log ?? []) as Log[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const base = Number(quote.subtotal) + Number(quote.freight_amount);
  const discount = Math.round((base - Number(quote.total)) * 100) / 100;
  const status: string = quote.status;
  const canSend = status === "draft" || status === "send_failed";
  const cnpj = String(client?.cnpj ?? "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

  return (
    <AppShell title="Detalhes do orçamento">
      <div className="page-heading">
        <div>
          <Link className="back" href="/orcamentos/lista">← Voltar à lista</Link>
          <h1>{quoteLabel(quote)}{status === "draft" && quote.quote_number ? " (rascunho)" : ""}</h1>
          <p>
            <span className={`badge ${status}`}>{statusLabel[status]}</span>{" "}
            · criado em {date(quote.created_at)}{quote.sent_at && ` · enviado em ${dateTime(quote.sent_at)}`}
          </p>
        </div>
        <div className="detail-actions">
          {status === "draft" && <Link className="primary-action" href={`/orcamentos/${id}/editar`}>Editar</Link>}
          {quote.pdf_path && <a className="secondary-action" href={`/api/orcamentos/${id}/pdf`}>Baixar PDF</a>}
          {(status === "sent" || status === "send_failed") && <ActionButton action={createRevision} id={id} label="Criar revisão" />}
          {status !== "deleted" && <ActionButton action={duplicateQuote} id={id} label="Duplicar" />}
          {canSend || status === "sent" ? <ActionButton action={cancelQuote} id={id} label="Cancelar" className="secondary-action danger-action" /> : null}
          {status === "deleted"
            ? <ActionButton action={restoreQuote} id={id} label="Restaurar" className="primary-action" />
            : <ActionButton action={deleteQuote} id={id} label="Excluir" className="secondary-action danger-action" />}
        </div>
      </div>

      {Object.entries(notices).map(([key, text]) => p[key] && <p key={key} className="notice success">{text}</p>)}
      {status === "deleted" && <p className="notice error">Este orçamento está excluído e não aparece nas listas. Use “Restaurar” para recuperá-lo.</p>}
      {p.error && <p className="notice error">{p.error}</p>}

      <div className="quote-detail">
        <main>
          <article className="panel">
            <h2>Cliente</h2>
            <strong>{client?.company_name}</strong>
            <p className="muted">{client?.contact_name} · CNPJ {cnpj}<br />{client?.city}/{client?.state}</p>
          </article>
          <article className="panel">
            <h2>Itens</h2>
            <table>
              <thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead>
              <tbody>{items.map(item => <tr key={item.id}><td>{item.description}</td><td>{String(Number(item.quantity)).replace(".", ",")}</td><td>{money(item.unit_price)}</td><td>{money(item.subtotal)}</td></tr>)}</tbody>
            </table>
            {discount > 0 && <p className="muted" style={{ textAlign: "right" }}>Valor antes do desconto: {money(base)} · Desconto: {discountText(quote, discount)}</p>}
            <div className="total">Total{discount > 0 ? " com desconto" : ""}: {money(quote.total)}</div>
          </article>
          {quote.notes && <article className="panel"><h2>Observações</h2><p style={{ whiteSpace: "pre-wrap" }}>{quote.notes}</p></article>}
          <article className="panel">
            <h2>Histórico de envio</h2>
            {logs.length ? (
              <table>
                <thead><tr><th>Destinatário</th><th>Situação</th><th>Quando</th></tr></thead>
                <tbody>{logs.map(log => <tr key={log.id}><td>{log.recipient}</td><td>{deliveryLogLabel[log.status] ?? log.status}{log.error_message && <><br /><small className="muted">{log.error_message}</small></>}</td><td>{dateTime(log.created_at)}</td></tr>)}</tbody>
              </table>
            ) : <p className="muted">Ainda não houve tentativa de envio.</p>}
            <p className="muted"><small>“Aceito pelo provedor” significa que o servidor de e-mail recebeu a mensagem; não confirma que chegou à caixa do cliente.</small></p>
          </article>
        </main>
        <aside>
          <article className="panel">
            <h2>Condições comerciais</h2>
            <p>Validade: <strong>{validityText(quote)}</strong></p>
            <p>Entrega: <strong>{deliveryText(quote)}</strong></p>
            <p>Frete: <strong>{freightLabel[quote.freight]}{quote.freight !== "customer_transport" && ` · ${money(quote.freight_amount)}`}</strong></p>
            <p>Pagamento: <strong>{paymentLabel[quote.payment]}</strong></p>
          </article>
          {canSend && (
            <article className="panel" id="enviar">
              <h2>{status === "draft" ? "Finalizar e enviar" : "Reenviar"}</h2>
              <p className="muted">
                {status === "draft"
                  ? "Ao finalizar, o orçamento recebe número, os dados ficam congelados e o PDF é guardado de forma privada."
                  : "O envio anterior falhou. Confira os destinatários e tente de novo."}
              </p>
              <form action={finalizeDraft}>
                <input type="hidden" name="id" value={id} />
                <p><strong>O PDF será enviado para:</strong></p>
                <div className="recipient-list">
                  {emails.map(email => <label key={email}><input type="checkbox" name="recipient" value={email} defaultChecked /> {email}</label>)}
                  {!emails.length && <p className="muted">Este cliente não tem e-mail cadastrado.</p>}
                </div>
                <label>Outros e-mails (opcional)<input name="extra_recipients" placeholder="separe por vírgula" /></label>
                <button className="primary-action">{status === "draft" ? "Finalizar e enviar" : "Reenviar"}</button>
              </form>
            </article>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
