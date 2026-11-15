import { jsPDF } from "jspdf";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { date, deliveryText, discountText, freightLabel, money, paymentLabel, quoteLabel } from "@/lib/format";

type Party = { company_name?: string; contact_name?: string; cnpj?: string; city?: string; state?: string };

const PAGE_BOTTOM = 280;
const RED: [number, number, number] = [210, 35, 42];
const COMPANY = [
  "TOP USINAGEM - Eletroerosão a Fio Ltda.",
  "Rua Dona Francisca, N° 11179, Distrito Industrial Norte - Joinville - SC",
  "CEP: 89219-615 · Fone: (47) 3435-2683 · E-mail: top@topusinagem.com",
  "CNPJ: 10.481.458/0001-63 · Inscrição Estadual: 25.610.677-0",
];
const formatCnpj = (cnpj = "") => cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const quantity = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

function validity(quote: any) {
  if (quote.valid_until) return `Até ${date(quote.valid_until)}`;
  if (!quote.validity_days) return "—";
  if (!quote.finalized_at) return `${quote.validity_days} dias`;
  const end = new Date(quote.finalized_at);
  end.setDate(end.getDate() + Number(quote.validity_days));
  return `${quote.validity_days} dias (até ${date(end.toISOString())})`;
}

/**
 * Gera o PDF do orçamento. Depois de finalizado usa os dados congelados do cliente
 * (customer_snapshot); rascunhos saem marcados como "RASCUNHO - SEM VALIDADE".
 */
export async function makeQuotePdf(quote: any): Promise<Buffer> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const logo = await readFile(join(process.cwd(), "public", "logo-top-usinagem.png"));
  const client: Party = quote.customer_snapshot ?? quote.clients ?? {};
  const isDraft = !quote.quote_number || quote.status === "draft";
  const label = isDraft ? "RASCUNHO - SEM VALIDADE" : quoteLabel(quote).toUpperCase();
  const items = [...(quote.quote_items ?? [])].sort((a: any, b: any) => a.position - b.position);

  // Cabeçalho -----------------------------------------------------------------
  pdf.addImage(logo.toString("base64"), "PNG", 14, 10, 70, 25, "logo", "FAST");
  pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(60);
  pdf.text(COMPANY, 196, 15, { align: "right", lineHeightFactor: 1.5 });
  pdf.setDrawColor(...RED).setLineWidth(0.8).line(14, 40, 196, 40);
  pdf.setFont("helvetica", "bold").setFontSize(15).setTextColor(20).text("PLANILHA DE ORÇAMENTO", 14, 51);
  pdf.setFontSize(10).setTextColor(...(isDraft ? RED : [20, 20, 20] as [number, number, number])).text(label, 196, 49, { align: "right" });
  pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90);
  pdf.text(`Emissão: ${date(quote.finalized_at ?? quote.created_at)}`, 196, 54, { align: "right" });

  // Cliente e condições, em duas colunas ------------------------------------------
  const field = (title: string, value: string, x: number, y: number, width: number) => {
    pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(110).text(title.toUpperCase(), x, y);
    pdf.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(20);
    const lines = pdf.splitTextToSize(value || "—", width);
    pdf.text(lines, x, y + 4.5);
    return y + 4.5 + lines.length * 4.4 + 2.5;
  };
  pdf.setFillColor(247, 248, 250).roundedRect(14, 59, 182, 47, 2, 2, "F");
  let left = 65, right = 65;
  left = field("Cliente", client.company_name ?? "", 19, left, 85);
  left = field("Responsável", client.contact_name ?? "", 19, left, 85);
  left = field("CNPJ", formatCnpj(client.cnpj), 19, left, 85);
  left = field("Cidade", [client.city, client.state].filter(Boolean).join("/"), 19, left, 85);
  right = field("Validade", validity(quote), 110, right, 82);
  right = field("Prazo de entrega", deliveryText(quote), 110, right, 82);
  right = field("Frete", freightLabel[quote.freight] ?? quote.freight, 110, right, 82);
  right = field("Condição de pagamento", paymentLabel[quote.payment] ?? quote.payment, 110, right, 82);
  let y = Math.max(left, right, 106) + 6;

  // Tabela de itens -------------------------------------------------------------
  const cols = { n: 16, desc: 24, qty: 132, unit: 162, sub: 194 };
  const header = () => {
    pdf.setFillColor(35, 38, 43).rect(14, y - 5, 182, 8, "F");
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(255);
    pdf.text("#", cols.n, y); pdf.text("DESCRIÇÃO", cols.desc, y);
    pdf.text("QTD.", cols.qty, y, { align: "right" }); pdf.text("VALOR UNIT.", cols.unit, y, { align: "right" }); pdf.text("SUBTOTAL", cols.sub, y, { align: "right" });
    y += 8;
  };
  header();
  items.forEach((item: any, index: number) => {
    pdf.setFont("helvetica", "normal").setFontSize(9);
    const lines: string[] = pdf.splitTextToSize(String(item.description), 92);
    const height = lines.length * 4.2 + 3;
    if (y + height > PAGE_BOTTOM - 8) { pdf.addPage(); y = 20; header(); pdf.setFont("helvetica", "normal").setFontSize(9); }
    if (index % 2) pdf.setFillColor(250, 250, 251).rect(14, y - 4.5, 182, height, "F");
    pdf.setTextColor(20);
    pdf.text(String(index + 1), cols.n, y);
    pdf.text(lines, cols.desc, y, { lineHeightFactor: 1.3 });
    pdf.text(quantity(Number(item.quantity)), cols.qty, y, { align: "right" });
    pdf.text(money(item.unit_price), cols.unit, y, { align: "right" });
    pdf.text(money(item.subtotal), cols.sub, y, { align: "right" });
    y += height;
  });
  pdf.setDrawColor(200).setLineWidth(0.3).line(14, y - 2, 196, y - 2);

  // Resumo de valores -------------------------------------------------------------
  const freight = quote.freight === "customer_transport" ? 0 : Number(quote.freight_amount);
  const base = Number(quote.subtotal) + freight;
  const discount = Math.round((base - Number(quote.total)) * 100) / 100;
  const summary: [string, string][] = [["Total das peças", money(quote.subtotal)]];
  if (quote.freight !== "customer_transport") summary.push([`Frete (${freightLabel[quote.freight]})`, money(freight)]);
  if (discount > 0) summary.push(["Valor antes do desconto", money(base)], ["Desconto", discountText(quote, discount)]);
  const needed = summary.length * 6 + 16;
  if (y + needed > PAGE_BOTTOM) { pdf.addPage(); y = 20; }
  y += 5;
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(60);
  for (const [name, value] of summary) { pdf.text(name, 150, y, { align: "right" }); pdf.text(value, 194, y, { align: "right" }); y += 6; }
  pdf.setFillColor(...RED).roundedRect(110, y - 2, 86, 11, 1.5, 1.5, "F");
  pdf.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(255);
  pdf.text(discount > 0 ? "TOTAL COM DESCONTO" : "TOTAL", 114, y + 5.4);
  pdf.text(money(quote.total), 194, y + 5.4, { align: "right" });
  y += 18;

  // Observações (só quando existem) -------------------------------------------------
  const notes = String(quote.notes ?? "").trim();
  if (notes) {
    pdf.setFont("helvetica", "normal").setFontSize(9);
    const lines: string[] = pdf.splitTextToSize(notes, 182);
    if (y + 8 > PAGE_BOTTOM) { pdf.addPage(); y = 20; }
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(110).text("OBSERVAÇÕES", 14, y);
    y += 5;
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(20);
    for (const line of lines) { if (y > PAGE_BOTTOM) { pdf.addPage(); y = 20; } pdf.text(line, 14, y); y += 4.4; }
  }

  // Rodapé em todas as páginas ---------------------------------------------------------
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(225).setLineWidth(0.2).line(14, 287, 196, 287);
    pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(130);
    pdf.text(`TOP Usinagem · ${isDraft ? "Rascunho" : quoteLabel(quote)} · Prazos de pagamento contados a partir da entrega da peça.`, 14, 291);
    pdf.text(`Página ${page} de ${pages}`, 196, 291, { align: "right" });
  }
  return Buffer.from(pdf.output("arraybuffer"));
}

const pdfPath = (quote: any) => `${quote.client_id}/${quote.quote_year}/${quote.id}.pdf`;

/** Guarda o PDF no bucket privado com a sessão do próprio usuário (sem chave secreta). Nunca sobrescreve. */
export async function uploadQuotePdf(supabase: SupabaseClient, quote: any, bytes: Buffer) {
  const path = pdfPath(quote);
  const { error } = await supabase.storage.from("quote-pdfs").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`Não foi possível guardar o PDF: ${error.message}`);
  return path;
}

export async function downloadQuotePdf(supabase: SupabaseClient, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from("quote-pdfs").download(path);
  if (error || !data) throw new Error(`Não foi possível ler o PDF guardado: ${error?.message ?? "arquivo ausente"}`);
  return Buffer.from(await data.arrayBuffer());
}
