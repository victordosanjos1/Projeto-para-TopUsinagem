import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/app/components/app-shell";
import { QuoteEditor, type QuoteDraft } from "../../quote-editor";
import { saveDraft } from "../../actions";
import { quoteLabel } from "@/lib/format";

type Item = { position: number; description: string; quantity: number; unit_price: number };

export default async function EditQuote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; revision?: string; duplicated?: string }> }) {
  const { id } = await params, p = await searchParams, s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");
  const { data: quote } = await s.from("quotes").select("*,clients(company_name),quote_items(*)").eq("id", id).single();
  if (!quote) redirect("/orcamentos/lista");
  if (quote.status !== "draft") redirect(`/orcamentos/${id}?error=${encodeURIComponent("Só rascunhos podem ser editados. Para mudar um orçamento enviado, crie uma revisão.")}`);
  const { data: clients } = await s.from("clients").select("id,company_name").eq("is_active", true).order("company_name");

  const initial: QuoteDraft = {
    id: quote.id, client_id: quote.client_id,
    title: quote.quote_number ? (quote.clients as { company_name: string } | null)?.company_name ?? "" : "",
    items: ((quote.quote_items ?? []) as Item[]).sort((a, b) => a.position - b.position).map(i => ({ description: i.description, quantity: Number(i.quantity), unit: Number(i.unit_price) })),
    validity_days: quote.validity_days, valid_until: quote.valid_until, delivery_days: quote.delivery_days, delivery_to_agree: quote.delivery_to_agree,
    freight: quote.freight, freight_amount: Number(quote.freight_amount), discount_type: quote.discount_type, discount_value: Number(quote.discount_value),
    payment: quote.payment, notes: quote.notes,
  };
  // Um rascunho de cliente inativo continua editável: o cliente atual entra na lista.
  const options = clients?.some(c => c.id === quote.client_id) ? clients : [...(clients ?? []), { id: quote.client_id, company_name: `${(quote.clients as { company_name: string } | null)?.company_name} (inativo)` }];

  return (
    <AppShell title="Editar orçamento">
      <div className="page-heading">
        <div>
          <Link className="back" href={`/orcamentos/${id}`}>← Voltar ao orçamento</Link>
          <h1>Editar {quote.quote_number ? `${quoteLabel(quote)} (rascunho)` : "rascunho"}</h1>
          <p>As alterações só valem para o cliente depois de finalizar e enviar.</p>
        </div>
      </div>
      {p.revision && <p className="notice success">Revisão criada como rascunho. Ajuste o que precisar e finalize para enviar.</p>}
      {p.duplicated && <p className="notice success">Cópia criada como rascunho novo. Confira os dados antes de enviar.</p>}
      {p.error && <p className="notice error">{p.error}</p>}
      <QuoteEditor clients={options} action={saveDraft} initial={initial} />
    </AppShell>
  );
}
