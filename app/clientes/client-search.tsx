"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";
export function ClientSearch({ initial }: { initial?: string }) { const router=useRouter(), timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined); return <input className="live-search" defaultValue={initial} onChange={e=>{clearTimeout(timer.current);const value=e.target.value;timer.current=setTimeout(()=>router.replace(value?`/clientes?q=${encodeURIComponent(value)}`:"/clientes"),180)}} placeholder="Empresa, responsável, e-mail ou CNPJ"/>; }
