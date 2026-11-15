import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeQuotePdf, uploadQuotePdf } from "@/lib/quote-pdf";

async function downloadPdf(params: Promise<{ id: string }>) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params; const { data: quote, error } = await supabase.from("quotes").select("*,clients(company_name,contact_name,cnpj,city,state),quote_items(*)").eq("id", id).single();
  if (error || !quote) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
  try { const bytes = await makeQuotePdf(quote); const path = await uploadQuotePdf(quote, bytes); await supabase.from("quotes").update({ pdf_path: path }).eq("id", id); return new NextResponse(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="orcamento-${quote.quote_number ?? "rascunho"}.pdf"` } }); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Falha ao gerar PDF" }, { status: 500 }); }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { return downloadPdf(params); }
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { return downloadPdf(params); }
