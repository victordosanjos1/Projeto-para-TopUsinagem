export const money = (value: number | string | null | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
export const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—";
export const statusLabel: Record<string, string> = { draft: "Rascunho", sent: "Enviado", send_failed: "Falha no envio", cancelled: "Cancelado", deleted: "Excluído" };
export const paymentLabel: Record<string, string> = { cash: "À vista", days_28: "28 dias após a entrega", days_28_56: "28/56 dias após a entrega", days_28_56_84: "28/56/84 dias após a entrega", to_agree: "A combinar" };
export const freightLabel: Record<string, string> = { cif: "CIF", fob: "FOB", customer_transport: "Transporte próprio do cliente" };
