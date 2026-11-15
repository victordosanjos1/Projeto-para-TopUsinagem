"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";

export function ClientSearch({ initial, status }: { initial?: string; status: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return (
    <input
      className="live-search" type="search" defaultValue={initial} aria-label="Pesquisar clientes"
      placeholder="Pesquisar por empresa, responsável, e-mail ou CNPJ"
      onChange={e => {
        clearTimeout(timer.current);
        const value = e.target.value.trim();
        timer.current = setTimeout(() => router.replace(`/clientes?status=${status}${value ? `&q=${encodeURIComponent(value)}` : ""}`), 250);
      }}
    />
  );
}
