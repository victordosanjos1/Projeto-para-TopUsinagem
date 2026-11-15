import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/app/components/app-shell";
import { smtpStatus } from "@/lib/email";
import { testSmtp } from "./actions";

export default async function Settings({ searchParams }: { searchParams: Promise<{ smtp?: string }> }) {
  const p = await searchParams, s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/");
  const smtp = smtpStatus();
  const state = smtp.enabled && smtp.configured ? ["sent", "Ativo"] : smtp.configured ? ["send_failed", "Configurado, envio bloqueado"] : ["send_failed", "Pendente"];

  return (
    <AppShell title="Configurações">
      <div className="page-heading"><div><h1>Configurações</h1><p>Situação das integrações e regras do sistema.</p></div></div>
      {p.smtp && (p.smtp === "ok"
        ? <p className="notice success">Conexão com o servidor de e-mail funcionando. Nenhuma mensagem foi enviada.</p>
        : <p className="notice error">Falha ao conectar no servidor de e-mail: {p.smtp}</p>)}
      <div className="settings-grid">
        <article className="panel">
          <span className={`badge ${state[0]}`}>{state[1]}</span>
          <h2>Envio de e-mail</h2>
          <dl className="facts">
            <dt>Remetente</dt><dd>{smtp.from ?? "—"}</dd>
            <dt>Servidor</dt><dd>{smtp.host ? `${smtp.host}:${smtp.port}` : "não configurado"}</dd>
            <dt>Usuário e senha</dt><dd>{smtp.configured ? "preenchidos" : "faltando"}</dd>
            <dt>Envio liberado</dt><dd>{smtp.enabled ? "sim" : "não"} <code>EMAIL_SENDING_ENABLED={String(smtp.enabled)}</code></dd>
          </dl>
          <p className="muted"><small>Os dados ficam no arquivo <code>.env.local</code> (ou nas variáveis da hospedagem), nunca no código. Depois de mudar, reinicie o servidor.</small></p>
          {smtp.configured && <form action={testSmtp}><button className="secondary-action">Testar conexão (não envia e-mail)</button></form>}
        </article>
        <article className="panel">
          <span className="badge sent">Privado</span>
          <h2>Documentos PDF</h2>
          <p>Os PDFs ficam no bucket privado <strong>quote-pdfs</strong>, acessíveis somente para usuários internos autenticados.</p>
          <p className="muted">O PDF é gerado uma única vez, ao finalizar. Para mudar um orçamento enviado, crie uma revisão.</p>
        </article>
        <article className="panel settings-wide">
          <h2>Estados dos orçamentos</h2>
          <div className="states">
            <div><span className="badge draft">Rascunho</span><small>Sem número e ainda editável.</small></div>
            <div><span className="badge sent">Enviado</span><small>Numerado, PDF guardado e e-mail aceito pelo provedor.</small></div>
            <div><span className="badge send_failed">Falha no envio</span><small>Numerado e PDF guardado; permite reenviar.</small></div>
            <div><span className="badge cancelled">Cancelado</span><small>Preservado no histórico.</small></div>
            <div><span className="badge deleted">Excluído</span><small>Oculto das listas; pode ser restaurado.</small></div>
          </div>
        </article>
      </div>
    </AppShell>
  );
}
