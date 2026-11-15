"use client";
import { useState } from "react";
import { lineSubtotal, parseDecimal, type QuoteItemInput } from "@/lib/quote-math";
import { money } from "@/lib/format";

// Os campos guardam o texto digitado ("1,5", "1.234,56") e só convertem na hora da conta,
// assim a pessoa consegue digitar vírgula e casas decimais sem o campo "pular".
type Row = { key: number; description: string; quantity: string; unit: string };
const toText = (n: number) => (n ? String(n).replace(".", ",") : "");
const parse = (rows: Row[]): QuoteItemInput[] => rows.map(r => ({ description: r.description, quantity: parseDecimal(r.quantity), unit: parseDecimal(r.unit) }));

export function ItemsEditor({ initial, onChange }: { initial?: QuoteItemInput[]; onChange?: (items: QuoteItemInput[]) => void }) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.length
      ? initial.map((item, index) => ({ key: index + 1, description: item.description, quantity: toText(item.quantity), unit: toText(item.unit) }))
      : [{ key: 1, description: "", quantity: "1", unit: "" }],
  );
  const items = parse(rows);
  const subtotal = items.reduce((sum, item) => sum + lineSubtotal(item.quantity, item.unit), 0);

  function change(next: Row[]) {
    setRows(next);
    onChange?.(parse(next));
  }
  const update = (key: number, field: keyof Omit<Row, "key">, value: string) => change(rows.map(r => (r.key === key ? { ...r, [field]: value } : r)));

  return (
    <div className="full quote-items">
      <div className="section-label">
        <h2>Itens</h2>
        <span>Total dos itens: <strong>{money(subtotal)}</strong></span>
      </div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {rows.map((row, index) => (
        <div className="item-row" key={row.key}>
          <label>Descrição<input value={row.description} onChange={e => update(row.key, "description", e.target.value)} placeholder="Descrição da peça" required /></label>
          <label>Quantidade<input inputMode="decimal" value={row.quantity} onChange={e => update(row.key, "quantity", e.target.value)} placeholder="1" required pattern="[0-9.,]*[1-9][0-9.,]*" title="Informe uma quantidade maior que zero" /></label>
          <label>Valor unitário<input inputMode="decimal" value={row.unit} onChange={e => update(row.key, "unit", e.target.value)} placeholder="0,00" required pattern="[0-9.,\sR$]+" title="Use números, por exemplo 1.234,56" /></label>
          <strong>{money(lineSubtotal(items[index].quantity, items[index].unit))}</strong>
          <button type="button" className="text-button" disabled={rows.length === 1} onClick={() => change(rows.filter(r => r.key !== row.key))}>Remover</button>
        </div>
      ))}
      <button type="button" className="secondary-action" onClick={() => change([...rows, { key: Math.max(...rows.map(r => r.key)) + 1, description: "", quantity: "1", unit: "" }])}>+ Adicionar peça</button>
    </div>
  );
}
