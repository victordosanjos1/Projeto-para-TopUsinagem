"use client";
import { useMemo, useState } from "react";
type Item = { id: number; description: string; quantity: number; unit: number };
export function ItemsEditor() {
  const [items, setItems] = useState<Item[]>([{ id: 1, description: "", quantity: 1, unit: 0 }]);
  const update = (id: number, key: keyof Item, value: string) => setItems(current => current.map(item => item.id === id ? { ...item, [key]: key === "description" ? value : Number(value.replace(",", ".")) || 0 } : item));
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unit, 0), [items]);
  const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  return <div className="full quote-items"><div className="section-label"><h2>Itens</h2><span>Total dos itens: <strong>{currency(subtotal)}</strong></span></div><input type="hidden" name="items" value={JSON.stringify(items)} />{items.map(item => <div className="item-row" key={item.id}><label>Descrição<input value={item.description} onChange={e => update(item.id, "description", e.target.value)} placeholder="Descrição da peça" required /></label><label>Quantidade<input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => update(item.id, "quantity", e.target.value)} required /></label><label>Valor unitário<input inputMode="decimal" value={item.unit || ""} onChange={e => update(item.id, "unit", e.target.value)} placeholder="0,00" required /></label><strong>{currency(item.quantity * item.unit)}</strong><button type="button" className="text-button" disabled={items.length === 1} onClick={() => setItems(current => current.filter(x => x.id !== item.id))}>Remover</button></div>)}<button type="button" className="secondary-action" onClick={() => setItems(current => [...current, { id: Date.now(), description: "", quantity: 1, unit: 0 }])}>+ Adicionar peça</button></div>;
}
