// Contas do orçamento em centavos (inteiros), para não acumular erro de ponto flutuante.
// Usado tanto na tela (prévia) quanto no servidor (valor gravado), então os dois sempre batem.

/** Converte texto digitado no padrão brasileiro em número. Aceita "1.234,56", "1234,56", "1,5", "1.5" e "1.000". */
export function parseDecimal(input: unknown): number {
  let text = String(input ?? "").replace(/[R$\s]/g, "");
  if (!text) return 0;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, ""); // "1.000" = mil
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

const cents = (reais: number) => Math.round(reais * 100);
const reais = (value: number) => value / 100;

export type QuoteItemInput = { description: string; quantity: number; unit: number };
export type FreightMode = "cif" | "fob" | "customer_transport";
export type DiscountType = "money" | "percent";

/** Subtotal de uma linha, arredondado ao centavo. 20 × R$ 100,00 = R$ 2.000,00. */
export function lineSubtotal(quantity: number, unit: number): number {
  return reais(Math.round(quantity * cents(unit)));
}

export function computeTotals(input: {
  items: QuoteItemInput[];
  freightMode: FreightMode | string;
  freightAmount: number;
  discountType: DiscountType | string;
  discountValue: number;
}) {
  const subtotalCents = input.items.reduce((sum, item) => sum + cents(lineSubtotal(item.quantity, item.unit)), 0);
  // Transporte próprio do cliente: não há valor de frete.
  const freightCents = input.freightMode === "customer_transport" ? 0 : cents(input.freightAmount);
  const baseCents = subtotalCents + freightCents;
  const percent = input.discountType === "percent";
  const discountValue = percent ? Math.min(input.discountValue, 100) : input.discountValue;
  const discountCents = Math.min(baseCents, percent ? Math.round((baseCents * discountValue) / 100) : cents(discountValue));
  return {
    subtotal: reais(subtotalCents),
    freight: reais(freightCents),
    base: reais(baseCents),
    discountValue,
    discount: reais(discountCents),
    total: reais(baseCents - discountCents),
  };
}
