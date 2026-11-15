"use client";
import { useRef, useState } from "react";
import { ItemsEditor } from "./items-editor";
import { FormEnterNext } from "@/app/components/form-enter-next";
import { computeTotals, lineSubtotal, parseDecimal, type QuoteItemInput } from "@/lib/quote-math";
import { date, deliveryText, discountText, freightLabel, money, paymentLabel } from "@/lib/format";

type Client = { id: string; company_name: string };
export type QuoteDraft = {
  id: string; client_id: string; title: string; items: QuoteItemInput[];
  validity_days: number | null; valid_until: string | null; delivery_days: number | null; delivery_to_agree: boolean;
  freight: string; freight_amount: number; discount_type: string | null; discount_value: number; payment: string; notes: string | null;
};
type Preview = ReturnType<typeof computeTotals> & {
  client: string; items: QuoteItemInput[]; freightMode: string; payment: string; notes: string;
  delivery: string; validity: string; discountType: string;
};
const decimalText = (n: number | undefined) => (n ? n.toFixed(2).replace(".", ",") : "0,00");

export function QuoteEditor({ clients, action, initial, defaultClientId }: { clients: Client[]; action: (data: FormData) => void | Promise<void>; initial?: QuoteDraft; defaultClientId?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [freightMode, setFreightMode] = useState(initial?.freight ?? "cif");
  const [validityMode, setValidityMode] = useState(initial?.valid_until ? "date" : "days");
  const today = new Date().toISOString().slice(0, 10);

  function openPreview() {
    if (!ref.current?.reportValidity()) return;
    const d = new FormData(ref.current);
    const items: QuoteItemInput[] = JSON.parse(String(d.get("items") ?? "[]"));
    const totals = computeTotals({ items, freightMode: String(d.get("freight")), freightAmount: parseDecimal(d.get("freight_amount")), discountType: String(d.get("discount_type")), discountValue: parseDecimal(d.get("discount")) });
    const deliveryDays = Number(d.get("delivery_days")) || null;
    setPreview({
      ...totals, items,
      client: initial?.client_id && !d.get("client_id") ? initial.title : clients.find(c => c.id === d.get("client_id"))?.company_name ?? "",
      freightMode: String(d.get("freight")), payment: String(d.get("payment")), notes: String(d.get("notes") ?? "").trim(),
      delivery: deliveryText({ delivery_days: deliveryDays, delivery_to_agree: !deliveryDays }),
      validity: validityMode === "date" ? `Até ${date(String(d.get("valid_until")))}` : `${d.get("validity_days")} dias`,
      discountType: String(d.get("discount_type")),
    });
    window.scrollTo({ top: 0 });
  }

  return (
    <FormEnterNext>
      <form ref={ref} action={action} className="quote-form-wrap">
        {initial && <input type="hidden" name="quote_id" value={initial.id} />}

        {/* Os campos continuam montados (só escondidos) durante a prévia: ao voltar, nada é perdido. */}
        <div className="quote-form" hidden={!!preview}>
          <main>
            <article className="panel">
              <h2>Cliente</h2>
              {initial?.title ? (
                <p><strong>{initial.title}</strong><br /><small className="muted">O cliente não muda depois que o orçamento tem número.</small></p>
              ) : (
                <label>Selecionar cliente *
                  <select name="client_id" required defaultValue={initial?.client_id ?? defaultClientId ?? ""}>
                    <option value="">Selecione</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </label>
              )}
            </article>
            <article className="panel"><ItemsEditor initial={initial?.items} /></article>
            <article className="panel">
              <label>Observações<textarea name="notes" defaultValue={initial?.notes ?? ""} placeholder="Aparece no PDF somente se for preenchido (opcional)" /></label>
            </article>
          </main>
          <aside>
            <article className="panel">
              <h2>Condições comerciais</h2>
              <label>Validade *
                <select value={validityMode} onChange={e => setValidityMode(e.target.value)}>
                  <option value="days">Quantidade de dias</option>
                  <option value="date">Até uma data</option>
                </select>
              </label>
              {validityMode === "days"
                ? <label>Dias de validade *<input name="validity_days" type="number" min={1} max={365} required defaultValue={initial?.validity_days ?? 15} /></label>
                : <label>Válido até *<input name="valid_until" type="date" min={today} required defaultValue={initial?.valid_until ?? ""} /></label>}
              <label>Prazo de entrega *
                <select name="delivery_days" defaultValue={initial ? (initial.delivery_to_agree ? "" : String(initial.delivery_days ?? "")) : "3"}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 1 ? "1 dia útil" : `${n} dias úteis`}</option>)}
                  <option value="">A combinar</option>
                </select>
              </label>
              <label>Frete *
                <select name="freight" value={freightMode} onChange={e => setFreightMode(e.target.value)}>
                  {Object.entries(freightLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {freightMode !== "customer_transport" && (
                <label>Valor do frete<input name="freight_amount" inputMode="decimal" defaultValue={decimalText(initial?.freight_amount)} /></label>
              )}
              <label>Tipo de desconto
                <select name="discount_type" defaultValue={initial?.discount_type ?? "money"}>
                  <option value="money">R$</option>
                  <option value="percent">%</option>
                </select>
              </label>
              <label>Desconto<input name="discount" inputMode="decimal" defaultValue={decimalText(initial?.discount_value)} /></label>
              <label>Pagamento *
                <select name="payment" defaultValue={initial?.payment ?? "days_28"}>
                  {Object.entries(paymentLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </article>
            <article className="panel">
              <button type="button" className="primary-action" onClick={openPreview}>Ver prévia do orçamento</button>
            </article>
          </aside>
        </div>

        {preview && (
          <div className="quote-preview-screen">
            <div className="preview-actions">
              <button type="button" className="secondary-action" onClick={() => setPreview(null)}>← Voltar e editar</button>
              <div>
                <button className="secondary-action" name="intent" value="draft">Salvar como rascunho</button>
                <button className="primary-action" name="intent" value="finalize">Salvar e escolher destinatários →</button>
              </div>
            </div>
            <article className="document-preview">
              <header>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-top-usinagem.png" alt="TOP Usinagem" />
                <p><strong>TOP USINAGEM - Eletroerosão a Fio Ltda.</strong><br />Rua Dona Francisca, N° 11179, Distrito Industrial Norte - Joinville - SC<br />CEP: 89219-615 · Fone: (47) 3435-2683 · top@topusinagem.com<br />CNPJ: 10.481.458/0001-63 · Inscrição Estadual: 25.610.677-0</p>
              </header>
              <div className="document-title"><h2>PLANILHA DE ORÇAMENTO</h2><span>PRÉVIA</span></div>
              <h3>Cliente</h3><strong>{preview.client}</strong>
              <h3>Itens</h3>
              <table>
                <thead><tr><th>Descrição</th><th className="num">Qtd.</th><th className="num">Valor unitário</th><th className="num">Subtotal</th></tr></thead>
                <tbody>{preview.items.map((item, n) => <tr key={n}><td>{item.description}</td><td className="num">{String(item.quantity).replace(".", ",")}</td><td className="num nowrap">{money(item.unit)}</td><td className="num nowrap">{money(lineSubtotal(item.quantity, item.unit))}</td></tr>)}</tbody>
              </table>
              <section className="document-conditions">
                <p><strong>Frete:</strong> {freightLabel[preview.freightMode]}{preview.freightMode !== "customer_transport" && ` · ${money(preview.freight)}`}</p>
                <p><strong>Entrega:</strong> {preview.delivery}</p>
                <p><strong>Validade:</strong> {preview.validity}</p>
                <p><strong>Pagamento:</strong> {paymentLabel[preview.payment]}</p>
              </section>
              <section className="document-summary">
                {preview.discount > 0 && <>
                  <p>Valor antes do desconto: <strong>{money(preview.base)}</strong></p>
                  <p>Desconto: <strong>{discountText({ discount_type: preview.discountType, discount_value: preview.discountValue }, preview.discount)}</strong></p>
                </>}
                {preview.notes && <p><strong>Observações:</strong> {preview.notes}</p>}
              </section>
              <div className="document-total">TOTAL{preview.discount > 0 ? " COM DESCONTO" : ""}: {money(preview.total)}</div>
            </article>
          </div>
        )}
      </form>
    </FormEnterNext>
  );
}
