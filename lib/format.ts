export const money = (value: number | string | null | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
export const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: value.length === 10 ? "UTC" : "America/Sao_Paulo" }).format(new Date(value)) : "—";
export const dateTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
export const statusLabel: Record<string, string> = { draft: "Rascunho", sent: "Enviado", send_failed: "Falha no envio", cancelled: "Cancelado", deleted: "Excluído" };
export const paymentLabel: Record<string, string> = { cash: "À vista", days_28: "28 dias após a entrega", days_28_56: "28/56 dias após a entrega", days_28_56_84: "28/56/84 dias após a entrega", to_agree: "A combinar" };
export const freightLabel: Record<string, string> = { cif: "CIF", fob: "FOB", customer_transport: "Transporte próprio do cliente" };
export const deliveryLogLabel: Record<string, string> = { accepted: "Aceito pelo provedor", failed: "Falhou", delivered: "Entregue" };

type QuoteRef = { quote_number?: number | null; quote_year?: number | null; revision?: number | null };

/** "01/2026", "01/2026 - Revisão 2" ou "Rascunho". */
export function quoteNumber(q: QuoteRef): string {
  if (!q.quote_number) return "Rascunho";
  const base = `${String(q.quote_number).padStart(2, "0")}/${q.quote_year}`;
  return q.revision && q.revision > 1 ? `${base} - Revisão ${q.revision}` : base;
}

/** "Orçamento 01/2026 - Revisão 2" ou "Rascunho". Rascunho de revisão mostra o número-base. */
export function quoteLabel(q: QuoteRef): string {
  return q.quote_number ? `Orçamento ${quoteNumber(q)}` : "Rascunho";
}

export function deliveryText(q: { delivery_to_agree?: boolean | null; delivery_days?: number | null }) {
  if (q.delivery_to_agree || !q.delivery_days) return "A combinar";
  return q.delivery_days === 1 ? "1 dia útil" : `${q.delivery_days} dias úteis`;
}

export function validityText(q: { valid_until?: string | null; validity_days?: number | null }) {
  if (q.valid_until) return `Até ${date(q.valid_until)}`;
  return q.validity_days ? `${q.validity_days} dias` : "—";
}

export function discountText(q: { discount_type?: string | null; discount_value?: number | string | null }, discountAmount: number) {
  return q.discount_type === "percent" ? `${Number(q.discount_value)}% (${money(discountAmount)})` : money(discountAmount);
}
