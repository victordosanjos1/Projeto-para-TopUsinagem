"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifySmtp } from "@/lib/email";

/** Testa o login no servidor SMTP. Não envia nenhuma mensagem. */
export async function testSmtp() {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");
  let result = "ok";
  try { await verifySmtp(); } catch (cause) { result = cause instanceof Error ? cause.message : "Falha desconhecida"; }
  redirect(`/configuracoes?smtp=${encodeURIComponent(result)}`);
}
