import { jsPDF } from "jspdf";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { freightLabel, paymentLabel } from "@/lib/format";

const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export async function makeQuotePdf(quote: any) {
  const pdf = new jsPDF(); const logo = await readFile(join(process.cwd(), "public", "logo-top-usinagem.png"));
  pdf.addImage(logo.toString("base64"), "PNG", 14, 10, 78, 28);
  pdf.setFontSize(7.3); pdf.setTextColor(35); pdf.text(["TOP USINAGEM - Eletroerosão a Fio Ltda.", "Rua Dona Francisca, N° 11179, Bairro Distrito Industrial Norte - Joinville - SC", "CEP: 89219-615 · Fone: (47) 3435-2683 · E-mail: top@topusinagem.com", "CNPJ: 10.481.458/0001-63 · Inscrição Estadual: 25.610.677-0"], 196, 15, { align: "right" });
  pdf.setDrawColor(210, 35, 42); pdf.setLineWidth(.8); pdf.line(14, 42, 196, 42); pdf.setTextColor(20); pdf.setFontSize(15); pdf.text("PLANILHA DE ORÇAMENTO", 14, 54); pdf.setFontSize(9); pdf.text(`ORÇAMENTO ${String(quote.quote_number).padStart(2, "0")}/${quote.quote_year}`, 196, 54, { align: "right" });
  const client = quote.clients; pdf.setFontSize(9); pdf.text([`Cliente: ${client?.company_name ?? ""}`, `Responsável: ${client?.contact_name ?? ""}`, `CNPJ: ${client?.cnpj ?? ""}`, `Cidade: ${client?.city ?? ""}/${client?.state ?? ""}`, `Validade: ${quote.validity_days ?? "—"} dias`, `Prazo de entrega: ${quote.delivery_to_agree ? "A combinar" : `${quote.delivery_days ?? "—"} dias úteis`}`, `Frete: ${freightLabel[quote.freight] ?? quote.freight} · ${currency(Number(quote.freight_amount))}`, `Condição de pagamento: ${paymentLabel[quote.payment] ?? quote.payment}`], 14, 66);
  let y = 111; pdf.setFontSize(9); ["Descrição", "Qtd.", "Valor unitário", "Subtotal"].forEach((text, index) => pdf.text(text, [14, 110, 137, 170][index], y)); y += 7;
  for (const item of quote.quote_items ?? []) { if (y > 260) { pdf.addPage(); y = 20; } pdf.text(String(item.description).slice(0, 55), 14, y); pdf.text(String(item.quantity), 110, y); pdf.text(currency(Number(item.unit_price)), 137, y); pdf.text(currency(Number(item.subtotal)), 170, y); y += 7; }
  const base = Number(quote.subtotal) + Number(quote.freight_amount); const discount = quote.discount_type === "percent" ? base * Number(quote.discount_value) / 100 : Number(quote.discount_value); pdf.setDrawColor(190); pdf.line(14, y, 196, y); if (discount > 0) { pdf.setFontSize(9); pdf.text(`Valor antes do desconto: ${currency(base)}`, 196, y + 9, { align: "right" }); pdf.text(`Desconto: ${quote.discount_type === "percent" ? `${Number(quote.discount_value)}% (${currency(discount)})` : currency(discount)}`, 196, y + 16, { align: "right" }); } pdf.setFontSize(13); pdf.text(`${discount > 0 ? "TOTAL COM DESCONTO" : "TOTAL"}: ${currency(Number(quote.total))}`, 196, y + (discount > 0 ? 27 : 13), { align: "right" }); pdf.setFontSize(9); pdf.text(`Observações: ${quote.notes || ""}`, 14, y + (discount > 0 ? 40 : 26), { maxWidth: 180 });
  return Buffer.from(pdf.output("arraybuffer"));
}
export async function uploadQuotePdf(quote: any, bytes: Buffer) { const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY; if (!secret) throw new Error("SUPABASE_SECRET_KEY não configurada"); const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret); const path = `${quote.client_id}/${quote.quote_year}/${quote.id}.pdf`; const { error } = await admin.storage.from("quote-pdfs").upload(path, bytes, { contentType: "application/pdf", upsert: true }); if (error) throw error; return path; }
