import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadQuotePdf, makeQuotePdf } from "@/lib/quote-pdf";
import { quoteLabel } from "@/lib/format";

// Orçamento finalizado: devolve o PDF guardado (congelado), nunca gera de novo.
// Rascunho: gera uma prévia marcada "RASCUNHO - SEM VALIDADE", sem guardar.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { data: quote } = await supabase.from("quotes").select("*,clients(company_name,contact_name,cnpj,city,state),quote_items(*)").eq("id", id).single();
  if (!quote) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });

  try {
    const bytes = quote.pdf_path ? await downloadQuotePdf(supabase, quote.pdf_path) : await makeQuotePdf(quote);
    const name = quote.pdf_path ? quoteLabel(quote) : "rascunho";
    const download = new URL(request.url).searchParams.has("download");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Falha ao gerar PDF" }, { status: 500 });
  }
}
