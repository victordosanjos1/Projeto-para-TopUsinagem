import nodemailer from "nodemailer";
import { deliveryText, money, quoteLabel } from "@/lib/format";

// Envio pelo SMTP da Terra (ou outro). Fica bloqueado até EMAIL_SENDING_ENABLED=true,
// que só deve ser ligado com aprovação explícita do proprietário.

export function smtpStatus() {
  const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  return {
    configured,
    enabled: process.env.EMAIL_SENDING_ENABLED === "true",
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT ?? 587),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
  };
}

function transport() {
  const { configured, port } = smtpStatus();
  if (!configured) throw new Error("SMTP não configurado (SMTP_HOST, SMTP_USER e SMTP_PASSWORD)");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: port === 587,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
  });
}

/** Só testa login no servidor SMTP. Não envia nenhuma mensagem. */
export async function verifySmtp() {
  await transport().verify();
}

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendQuoteEmail({ recipients, quote, pdf }: { recipients: string[]; quote: any; pdf: Buffer }) {
  if (!smtpStatus().enabled) throw new Error("Envio de e-mail desativado até aprovação explícita");
  const label = quoteLabel(quote);
  const contact = String(quote.customer_snapshot?.contact_name ?? quote.clients?.contact_name ?? "").split(" ")[0];
  const greeting = contact ? `Olá, ${contact}` : "Olá";
  const lines = [`Total: ${money(quote.total)}`, `Prazo de entrega: ${deliveryText(quote)}`];
  const text = `${greeting},\n\nSegue em anexo o ${label} da TOP Usinagem.\n\n${lines.join("\n")}\n\nQualquer dúvida, é só responder este e-mail ou ligar para (47) 3435-2683.\n\nAtenciosamente,\nTOP Usinagem - Eletroerosão a Fio\n(47) 3435-2683 · top@topusinagem.com`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2328;line-height:1.5;max-width:560px">
<p>${escape(greeting)},</p><p>Segue em anexo o <strong>${escape(label)}</strong> da TOP Usinagem.</p>
<table style="border-collapse:collapse;margin:12px 0">${lines.map(l => { const [k, v] = l.split(": "); return `<tr><td style="padding:4px 16px 4px 0;color:#667085">${escape(k)}</td><td style="padding:4px 0"><strong>${escape(v)}</strong></td></tr>`; }).join("")}</table>
<p>Qualquer dúvida, é só responder este e-mail ou ligar para (47) 3435-2683.</p>
<p style="margin-top:24px;border-top:2px solid #d2232a;padding-top:10px">Atenciosamente,<br><strong>TOP Usinagem - Eletroerosão a Fio</strong><br><span style="color:#667085">(47) 3435-2683 · top@topusinagem.com</span></p></div>`;
  const from = smtpStatus().from!;
  const info = await transport().sendMail({
    from: { name: "TOP Usinagem", address: from }, replyTo: from, to: recipients,
    subject: `${label} - TOP Usinagem`, text, html,
    attachments: [{ filename: `${label.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  const rejected = (info.rejected ?? []).map(String).map(e => e.toLowerCase());
  if (rejected.length === recipients.length) throw new Error(`O servidor recusou todos os destinatários: ${rejected.join(", ")}`);
  return { messageId: info.messageId as string, rejected };
}
