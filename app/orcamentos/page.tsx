import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveDraft } from "./actions";
import { QuoteEditor } from "./quote-editor";
import { AppShell } from "@/app/components/app-shell";
export default async function Quotes({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const p = await searchParams, s = await createClient(); const { data: { user } } = await s.auth.getUser(); if (!user) redirect("/");
  const { data: clients } = await s.from("clients").select("id,company_name").eq("is_active", true).order("company_name");
  return <AppShell title="Novo orçamento"><div className="page-heading"><div><h1>Novo orçamento</h1><p>Preencha os dados e confira a prévia antes de salvar ou enviar.</p></div><Link className="secondary-action" href="/orcamentos/lista">Cancelar</Link></div>{p.error && <p className="notice error">{p.error}</p>}<QuoteEditor clients={clients ?? []} action={saveDraft} /></AppShell>;
}
