"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { makeQuotePdf, uploadQuotePdf } from "@/lib/quote-pdf";
import { sendQuoteEmail } from "@/lib/email";
const decimal = (v: FormDataEntryValue | null) => Number(String(v ?? "0").replace(/\./g, "").replace(",", ".")) || 0;

export async function saveDraft(form: FormData) {
  const s = await createClient(); const { data: { user } } = await s.auth.getUser(); if (!user) redirect("/");
  let items: { description: string; quantity: number; unit: number }[] = []; try { items = JSON.parse(String(form.get("items") ?? "[]")); } catch {}
  if (!items.length) { const descriptions = form.getAll("item_description"), quantities = form.getAll("item_quantity"), units = form.getAll("item_unit"); items = descriptions.map((description, index) => ({ description: String(description), quantity: decimal(quantities[index] ?? null), unit: decimal(units[index] ?? null) })); }
  items = items.filter(i => i.description.trim() && i.quantity > 0 && i.unit >= 0); const clientId = String(form.get("client_id") ?? "");
  if (!clientId || !items.length) redirect("/orcamentos?error=Inclua+ao+menos+um+item+valido");
  const freight = decimal(form.get("freight_amount")), discountInput = decimal(form.get("discount")); const subtotal = items.reduce((a, i) => a + i.quantity * i.unit, 0), beforeDiscount = subtotal + freight, discountType = String(form.get("discount_type")), discount = discountType === "percent" ? beforeDiscount * discountInput / 100 : discountInput, deliveryDays = String(form.get("delivery_days")); const total = Math.max(0, beforeDiscount - discount);
  const { data: quote, error } = await s.from("quotes").insert({ client_id: clientId, quote_year: new Date().getFullYear(), freight: String(form.get("freight")), freight_amount: freight, payment: String(form.get("payment")), validity_days: Number(form.get("validity_days")), delivery_days: deliveryDays || null, delivery_to_agree: !deliveryDays, discount_type: discountType, discount_value: discountInput, notes: String(form.get("notes") ?? ""), subtotal, total, created_by: user.id }).select("id").single();
  if (error || !quote) redirect(`/orcamentos?error=${encodeURIComponent(error?.message ?? "Não foi possível salvar o rascunho")}`);
  const { error: itemError } = await s.from("quote_items").insert(items.map((i, n) => ({ quote_id: quote.id, position: n + 1, description: i.description.trim(), quantity: i.quantity, unit_price: i.unit, subtotal: i.quantity * i.unit })));
  if (itemError) { await s.from("quotes").delete().eq("id", quote.id); redirect("/orcamentos?error=Nao+foi+possivel+salvar+os+itens"); }
  if (form.get("intent") === "finalize") { const finalForm = new FormData(); finalForm.set("id", quote.id); await finalizeDraft(finalForm); return; }
  redirect(`/orcamentos/${quote.id}?saved=1`);
}

export async function finalizeDraft(form: FormData) {
  const s = await createClient(); const { data: { user } } = await s.auth.getUser(); if (!user) redirect("/"); const id = String(form.get("id"));
  const { data: current } = await s.from("quotes").select("status,quote_number").eq("id", id).single();
  if (current?.status === "draft") { const { data: reserved, error: reserveError } = await s.rpc("reserve_quote_number", { p_quote_id: id }).single(); if (reserveError || !reserved) redirect(`/orcamentos/${id}?error=${encodeURIComponent(reserveError?.message ?? "Falha ao reservar número")}`); }
  else if (current?.status !== "send_failed" || !current.quote_number) redirect(`/orcamentos/${id}?error=Orcamento+nao+disponivel+para+envio`);
  const { data: quote, error } = await s.from("quotes").select("*,clients(company_name,contact_name,cnpj,city,state),quote_items(*)").eq("id", id).single(); if (error || !quote) redirect(`/orcamentos/${id}?error=Orcamento+nao+encontrado`);
  let recipients = String(form.get("recipients") ?? "").split(/[;,\n]/).map(x => x.trim()).filter(Boolean);
  if (!recipients.length) { const { data: emails } = await s.from("client_emails").select("email").eq("client_id", quote.client_id); recipients = emails?.map(email => email.email) ?? []; }
  if (!recipients.length) redirect(`/orcamentos/${id}?error=Informe+ao+menos+um+destinatario`);
  try { const pdf = await makeQuotePdf(quote); const pdfPath = await uploadQuotePdf(quote, pdf); await s.from("quotes").update({ pdf_path: pdfPath }).eq("id", id); const sent = await sendQuoteEmail({ recipients, quote, pdf }); await s.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id); await s.from("quote_delivery_log").insert(recipients.map(recipient => ({ quote_id: id, recipient, provider_message_id: sent.messageId, status: "accepted" }))); }
  catch (cause) { const message = cause instanceof Error ? cause.message : "Falha desconhecida"; await s.from("quotes").update({ status: "send_failed" }).eq("id", id); if (recipients.length) await s.from("quote_delivery_log").insert(recipients.map(recipient => ({ quote_id: id, recipient, status: "failed", error_message: message }))); redirect(`/orcamentos/${id}?error=${encodeURIComponent(`PDF gerado, mas o e-mail falhou: ${message}`)}`); }
  revalidatePath("/dashboard"); revalidatePath("/orcamentos/lista"); redirect(`/orcamentos/${id}?sent=1`);
}

export async function cancelQuote(form: FormData) {
  const s = await createClient(); const { data: { user } } = await s.auth.getUser(); if (!user) redirect("/");
  const id = String(form.get("id")); const { error } = await s.from("quotes").update({ status: "cancelled" }).eq("id", id).in("status", ["draft", "sent", "send_failed"]);
  if (error) redirect("/orcamentos/lista?error=Não+foi+possível+cancelar+o+orçamento");
  await s.from("audit_log").insert({ actor_id: user.id, action: "cancelled", entity_type: "quote", entity_id: id });
  revalidatePath("/dashboard"); revalidatePath("/orcamentos/lista"); redirect("/orcamentos/lista?cancelled=1");
}

export async function duplicateQuote(form: FormData) {
  const s = await createClient(); const { data: { user } } = await s.auth.getUser(); if (!user) redirect("/"); const id = String(form.get("id"));
  const { data: original } = await s.from("quotes").select("*,quote_items(*)").eq("id", id).single(); if (!original) redirect("/orcamentos/lista?error=Orçamento+não+encontrado");
  const { data: copy, error } = await s.from("quotes").insert({ client_id: original.client_id, quote_year: new Date().getFullYear(), revision: 1, status: "draft", customer_snapshot: original.customer_snapshot, valid_until: original.valid_until, validity_days: original.validity_days, freight: original.freight, freight_amount: original.freight_amount, delivery_days: original.delivery_days, delivery_to_agree: original.delivery_to_agree, payment: original.payment, discount_type: original.discount_type, discount_value: original.discount_value, notes: original.notes, subtotal: original.subtotal, total: original.total, created_by: user.id }).select("id").single();
  if (error || !copy) redirect("/orcamentos/lista?error=Não+foi+possível+duplicar+o+orçamento");
  const { error: itemsError } = await s.from("quote_items").insert((original.quote_items ?? []).map((item: any, index: number) => ({ quote_id: copy.id, position: index + 1, description: item.description, quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal })));
  if (itemsError) { await s.from("quotes").delete().eq("id", copy.id); redirect("/orcamentos/lista?error=Não+foi+possível+duplicar+os+itens"); }
  await s.from("audit_log").insert({ actor_id: user.id, action: "duplicated", entity_type: "quote", entity_id: copy.id, metadata: { source_quote_id: id } });
  redirect(`/orcamentos/${copy.id}?saved=1`);
}
