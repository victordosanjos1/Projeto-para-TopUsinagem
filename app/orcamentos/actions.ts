"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { downloadQuotePdf, makeQuotePdf, uploadQuotePdf } from "@/lib/quote-pdf";
import { sendQuoteEmail } from "@/lib/email";
import { computeTotals, lineSubtotal, parseDecimal, type QuoteItemInput } from "@/lib/quote-math";

const FREIGHT = ["cif", "fob", "customer_transport"];
const PAYMENT = ["cash", "days_28", "days_28_56", "days_28_56_84", "to_agree"];
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const fail = (path: string, message: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);

async function session() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");
  const audit = (action: string, entityId: string, metadata?: Record<string, unknown>) =>
    s.from("audit_log").insert({ actor_id: user.id, action, entity_type: "quote", entity_id: entityId, metadata: metadata ?? null });
  return { s, user, audit };
}

function refresh(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/orcamentos/lista");
  if (id) revalidatePath(`/orcamentos/${id}`);
}

/** Cria um rascunho novo ou atualiza um rascunho existente (campo quote_id). */
export async function saveDraft(form: FormData) {
  const { s, user, audit } = await session();
  const quoteId = String(form.get("quote_id") ?? "") || null;
  const back = quoteId ? `/orcamentos/${quoteId}/editar` : "/orcamentos";

  let items: QuoteItemInput[] = [];
  try { items = JSON.parse(String(form.get("items") ?? "[]")); } catch { /* tratado abaixo */ }
  items = items
    .map(i => ({ description: String(i.description ?? "").trim(), quantity: Number(i.quantity) || 0, unit: Number(i.unit) || 0 }))
    .filter(i => i.description && i.quantity > 0 && i.unit >= 0);
  if (!items.length) fail(back, "Inclua ao menos uma peça com descrição e quantidade.");

  let clientId = String(form.get("client_id") ?? "");
  if (quoteId) {
    const { data: existing } = await s.from("quotes").select("status,client_id,quote_number").eq("id", quoteId).single();
    if (!existing || existing.status !== "draft") fail(`/orcamentos/${quoteId}`, "Só rascunhos podem ser editados. Para mudar um orçamento enviado, crie uma revisão.");
    if (existing!.quote_number || !clientId) clientId = existing!.client_id; // revisão mantém o cliente
  }
  if (!clientId) fail(back, "Selecione um cliente.");

  const freight = String(form.get("freight"));
  const payment = String(form.get("payment"));
  const discountType = form.get("discount_type") === "percent" ? "percent" : "money";
  if (!FREIGHT.includes(freight) || !PAYMENT.includes(payment)) fail(back, "Condições comerciais inválidas.");

  const validUntil = String(form.get("valid_until") ?? "") || null;
  const validityDays = validUntil ? null : Math.trunc(Number(form.get("validity_days")));
  if (validUntil ? validUntil < new Date().toISOString().slice(0, 10) : !(validityDays! >= 1 && validityDays! <= 365))
    fail(back, "Informe uma validade em dias (1 a 365) ou uma data futura.");

  const deliveryDays = Number(form.get("delivery_days")) || null;
  if (deliveryDays !== null && (deliveryDays < 1 || deliveryDays > 5)) fail(back, "Prazo de entrega inválido.");

  const totals = computeTotals({ items, freightMode: freight, freightAmount: parseDecimal(form.get("freight_amount")), discountType, discountValue: parseDecimal(form.get("discount")) });
  const notes = String(form.get("notes") ?? "").trim();
  const fields = {
    client_id: clientId, freight, freight_amount: totals.freight, payment,
    validity_days: validityDays, valid_until: validUntil,
    delivery_days: deliveryDays, delivery_to_agree: deliveryDays === null,
    discount_type: totals.discount > 0 ? discountType : null, discount_value: totals.discount > 0 ? totals.discountValue : 0,
    notes: notes || null, subtotal: totals.subtotal, total: totals.total,
  };

  let id = quoteId;
  if (id) {
    const { error } = await s.from("quotes").update(fields).eq("id", id).eq("status", "draft");
    if (error) fail(back, "Não foi possível salvar o rascunho.");
  } else {
    const { data, error } = await s.from("quotes").insert({ ...fields, quote_year: new Date().getFullYear(), created_by: user.id }).select("id").single();
    if (error || !data) fail(back, error?.message ?? "Não foi possível salvar o rascunho.");
    id = data!.id;
  }

  // Grava as peças por posição e remove as que sobraram de uma versão anterior com mais itens.
  const rows = items.map((item, n) => ({ quote_id: id, position: n + 1, description: item.description, quantity: item.quantity, unit_price: item.unit, subtotal: lineSubtotal(item.quantity, item.unit) }));
  const { error: itemError } = await s.from("quote_items").upsert(rows, { onConflict: "quote_id,position" });
  if (itemError) {
    if (!quoteId) await s.from("quotes").delete().eq("id", id!);
    fail(back, "Não foi possível salvar as peças do orçamento.");
  }
  await s.from("quote_items").delete().eq("quote_id", id!).gt("position", items.length);
  await audit(quoteId ? "draft_updated" : "draft_created", id!, { total: totals.total });
  refresh(id!);

  if (form.get("intent") === "finalize") redirect(`/orcamentos/${id}?enviar=1#enviar`);
  redirect(`/orcamentos/${id}?saved=1`);
}

/** Finaliza (reserva número, congela dados, gera PDF) e envia. Também serve para reenviar após falha. */
export async function finalizeDraft(form: FormData) {
  const { s, audit } = await session();
  const id = String(form.get("id"));
  const page = `/orcamentos/${id}`;

  const typed = String(form.get("extra_recipients") ?? "").split(/[;,\s]+/);
  const recipients = [...new Set([...form.getAll("recipient").map(String), ...typed].map(e => e.trim().toLowerCase()).filter(Boolean))];
  const invalid = recipients.filter(e => !EMAIL.test(e));
  if (invalid.length) fail(page, `E-mail inválido: ${invalid.join(", ")}`);
  if (!recipients.length) fail(page, "Escolha ao menos um destinatário.");

  const { data: current } = await s.from("quotes").select("status,quote_number").eq("id", id).single();
  if (current?.status === "draft") {
    const { error } = await s.rpc("reserve_quote_number", { p_quote_id: id }).single();
    if (error) fail(page, `Não foi possível numerar o orçamento: ${error.message}`);
    await audit("finalized", id);
  } else if (current?.status !== "send_failed" || !current.quote_number) {
    fail(page, "Este orçamento não está disponível para envio.");
  }

  const { data: quote } = await s.from("quotes").select("*,clients(company_name,contact_name,cnpj,city,state),quote_items(*)").eq("id", id).single();
  if (!quote) fail(page, "Orçamento não encontrado.");

  let failure: string | null = null;
  try {
    // O PDF é gerado uma única vez, na finalização. Reenvios usam o mesmo arquivo guardado.
    let pdf: Buffer;
    if (quote!.pdf_path) pdf = await downloadQuotePdf(s, quote!.pdf_path);
    else {
      pdf = await makeQuotePdf(quote);
      const pdfPath = await uploadQuotePdf(s, quote, pdf);
      const { error: saveError } = await s.from("quotes").update({ pdf_path: pdfPath }).eq("id", id);
      if (saveError) throw new Error(`PDF guardado, mas não foi possível vinculá-lo ao orçamento: ${saveError.message}`);
    }
    const sent = await sendQuoteEmail({ recipients, quote, pdf });
    const { error: statusError } = await s.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (statusError) throw new Error(`E-mail enviado, mas não foi possível marcar como enviado: ${statusError.message}`);
    await s.from("quote_delivery_log").insert(recipients.map(recipient => sent.rejected.includes(recipient)
      ? { quote_id: id, recipient, provider_message_id: sent.messageId, status: "failed", error_message: "Destinatário recusado pelo servidor de e-mail" }
      : { quote_id: id, recipient, provider_message_id: sent.messageId, status: "accepted" }));
    await audit("sent", id, { recipients, rejected: sent.rejected });
  } catch (cause) {
    failure = cause instanceof Error ? cause.message : "Falha desconhecida";
    await s.from("quotes").update({ status: "send_failed" }).eq("id", id);
    await s.from("quote_delivery_log").insert(recipients.map(recipient => ({ quote_id: id, recipient, status: "failed", error_message: failure })));
    await audit("send_failed", id, { recipients, error: failure });
  }
  refresh(id);
  if (failure) fail(page, `Orçamento numerado, mas o envio falhou: ${failure}`);
  redirect(`${page}?sent=1`);
}

export async function cancelQuote(form: FormData) {
  const { s, audit } = await session();
  const id = String(form.get("id"));
  const { data, error } = await s.from("quotes").update({ status: "cancelled" }).eq("id", id).in("status", ["draft", "sent", "send_failed"]).select("id");
  if (error || !data?.length) fail(`/orcamentos/${id}`, "Não foi possível cancelar o orçamento.");
  await audit("cancelled", id);
  refresh(id);
  redirect(`/orcamentos/${id}?cancelled=1`);
}

/** Exclusão reversível: o documento fica oculto e guarda o estado anterior para poder ser restaurado. */
export async function deleteQuote(form: FormData) {
  const { s, audit } = await session();
  const id = String(form.get("id"));
  const { data: current } = await s.from("quotes").select("status").eq("id", id).single();
  if (!current || current.status === "deleted") fail(`/orcamentos/${id}`, "Orçamento não encontrado.");
  const { error } = await s.from("quotes").update({ status: "deleted", status_before_delete: current!.status, deleted_at: new Date().toISOString() }).eq("id", id).eq("status", current!.status);
  if (error) fail(`/orcamentos/${id}`, "Não foi possível excluir o orçamento.");
  await audit("deleted", id, { previous_status: current!.status });
  refresh(id);
  redirect("/orcamentos/lista?deleted=1");
}

export async function restoreQuote(form: FormData) {
  const { s, audit } = await session();
  const id = String(form.get("id"));
  const { data: current } = await s.from("quotes").select("status,status_before_delete").eq("id", id).single();
  if (current?.status !== "deleted") fail(`/orcamentos/${id}`, "Este orçamento não está excluído.");
  const restored = current!.status_before_delete ?? "draft";
  const { error } = await s.from("quotes").update({ status: restored, status_before_delete: null, deleted_at: null }).eq("id", id).eq("status", "deleted");
  if (error) fail(`/orcamentos/${id}`, "Não foi possível restaurar o orçamento.");
  await audit("restored", id, { status: restored });
  refresh(id);
  redirect(`/orcamentos/${id}?restored=1`);
}

/** Nova revisão de um orçamento enviado: mesmo número-base, revisão seguinte, começa como rascunho. */
export async function createRevision(form: FormData) {
  const { s } = await session();
  const id = String(form.get("id"));
  const { data, error } = await s.rpc("create_quote_revision", { p_quote_id: id });
  if (error || !data) fail(`/orcamentos/${id}`, error?.message ?? "Não foi possível criar a revisão.");
  refresh();
  redirect(`/orcamentos/${data}/editar?revision=1`);
}

/** Cópia como rascunho novo (sem número), para agilizar um pedido parecido. */
export async function duplicateQuote(form: FormData) {
  const { s, user, audit } = await session();
  const id = String(form.get("id"));
  const { data: original } = await s.from("quotes").select("*,quote_items(*)").eq("id", id).single();
  if (!original) fail("/orcamentos/lista", "Orçamento não encontrado.");
  const o = original!;
  const { data: copy, error } = await s.from("quotes").insert({
    client_id: o.client_id, quote_year: new Date().getFullYear(), validity_days: o.valid_until ? 15 : o.validity_days,
    freight: o.freight, freight_amount: o.freight_amount, delivery_days: o.delivery_days, delivery_to_agree: o.delivery_to_agree,
    payment: o.payment, discount_type: o.discount_type, discount_value: o.discount_value, notes: o.notes,
    subtotal: o.subtotal, total: o.total, created_by: user.id,
  }).select("id").single();
  if (error || !copy) fail("/orcamentos/lista", "Não foi possível duplicar o orçamento.");
  const items = (o.quote_items ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position);
  const { error: itemsError } = await s.from("quote_items").insert(items.map((item: { description: string; quantity: number; unit_price: number; subtotal: number }, n: number) => ({ quote_id: copy!.id, position: n + 1, description: item.description, quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal })));
  if (itemsError) { await s.from("quotes").delete().eq("id", copy!.id); fail("/orcamentos/lista", "Não foi possível duplicar as peças."); }
  await audit("duplicated", copy!.id, { source_quote_id: id });
  refresh();
  redirect(`/orcamentos/${copy!.id}/editar?duplicated=1`);
}
