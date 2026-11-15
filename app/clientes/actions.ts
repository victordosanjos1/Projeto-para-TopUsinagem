"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UFS, isValidCnpj, onlyDigits, parseEmails } from "@/lib/br";

const fail = (path: string, message: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);

// Erros de preenchimento voltam para o formulário (sem recarregar a página),
// para que nada do que foi digitado se perca.
export type FormResult = { error: string } | undefined;

function readCustomer(form: FormData) {
  const data = {
    company_name: String(form.get("company_name") ?? "").trim(),
    contact_name: String(form.get("contact_name") ?? "").trim(),
    cnpj: onlyDigits(form.get("cnpj")),
    city: String(form.get("city") ?? "").trim(),
    state: String(form.get("state") ?? "").trim().toUpperCase(),
    country: String(form.get("country") ?? "Brasil").trim() || "Brasil",
  };
  const emails = parseEmails(form.get("emails"));
  const error =
    !data.company_name || !data.contact_name || !data.city ? "Preencha empresa, responsável e cidade."
    : !isValidCnpj(data.cnpj) ? "CNPJ inválido. Confira os números."
    : !UFS.includes(data.state) ? "Selecione o estado (UF)."
    : emails.invalid.length ? `E-mail inválido: ${emails.invalid.join(", ")}`
    : !emails.valid.length ? "Informe ao menos um e-mail."
    : null;
  return { error, data, emails: emails.valid };
}

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return supabase;
}

export async function createCustomer(form: FormData): Promise<FormResult> {
  const supabase = await session();
  const { error: invalid, data, emails } = readCustomer(form);
  if (invalid) return { error: invalid };
  const { data: customer, error } = await supabase.from("clients").insert(data).select("id").single();
  if (error || !customer) return { error: error?.code === "23505" ? "Este CNPJ já está cadastrado." : "Não foi possível salvar o cliente." };
  const { error: emailsError } = await supabase.from("client_emails").insert(emails.map((email, index) => ({ client_id: customer!.id, email, is_primary: index === 0 })));
  if (emailsError) fail(`/clientes/${customer!.id}`, "Cliente criado, mas os e-mails não foram salvos. Tente de novo.");
  revalidatePath("/clientes");
  redirect(`/clientes?created=${customer!.id}`);
}

/** Atualiza dados e e-mails. O primeiro e-mail da lista vira o principal. */
export async function updateCustomer(form: FormData): Promise<FormResult> {
  const supabase = await session();
  const id = String(form.get("id"));
  const back = `/clientes/${id}`;
  const { error: invalid, data, emails } = readCustomer(form);
  if (invalid) return { error: invalid };
  const { error } = await supabase.from("clients").update(data).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Outro cliente já usa este CNPJ." : "Não foi possível salvar o cliente." };

  const { data: current } = await supabase.from("client_emails").select("id,email").eq("client_id", id);
  const removed = (current ?? []).filter(e => !emails.includes(e.email)).map(e => e.id);
  if (removed.length) await supabase.from("client_emails").delete().in("id", removed);
  const { error: emailsError } = await supabase.from("client_emails")
    .upsert(emails.map((email, index) => ({ client_id: id, email, is_primary: index === 0 })), { onConflict: "client_id,email" });
  if (emailsError) fail(back, "Dados salvos, mas houve erro ao salvar os e-mails.");
  revalidatePath("/clientes");
  redirect(`${back}?saved=1`);
}

export async function toggleCustomerStatus(form: FormData) {
  const supabase = await session();
  const id = String(form.get("id"));
  const active = String(form.get("active")) === "true";
  await supabase.from("clients").update({ is_active: !active }).eq("id", id);
  revalidatePath("/clientes");
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/clientes");
}
