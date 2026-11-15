import nodemailer from "nodemailer";

export async function sendQuoteEmail({ recipients, quote, pdf }: { recipients: string[]; quote: any; pdf: Buffer }) {
  if (process.env.EMAIL_SENDING_ENABLED !== "true") throw new Error("Envio de e-mail desativado até aprovação explícita");
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) throw new Error("SMTP não configurado");
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: Number(process.env.SMTP_PORT ?? 587) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
  return transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to: recipients.join(", "), subject: `Orçamento ${String(quote.quote_number).padStart(2, "0")}/${quote.quote_year} — TOP Usinagem`, text: "Olá,\n\nSegue em anexo o orçamento solicitado.\n\nAtenciosamente,\nTOP Usinagem", attachments: [{ filename: `orcamento-${quote.quote_number}.pdf`, content: pdf, contentType: "application/pdf" }] });
}
