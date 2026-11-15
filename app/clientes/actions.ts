"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UFS, isValidCnpj, onlyDigits, parseEmails } from "@/lib/br";

const fail = (path: string, message: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);

function readCustomer(form: FormData, back: string) {
  const data = {
    company_name: String(form.get("company_name") ?? "").trim(),
    contact_name: String(form.get("contact_name") ?? "").trim(),
    cnpj: onlyDigits(form.get("cnpj")),
    city: String(form.get("city") ?? "").trim(),
    state: String(form.get("state") ?? "").trim().toUpperCase(),
    country: String(form.get("country") ?? "Brasil").trim() || "Brasil",
  };
  const emails = parseEmails(form.get("emails"));
  if (!data.company_name || !data.contact_name || !data.city) fail(back, "Preencha empresa, responsável e cidade.");
  if (!isValidCnpj(data.cnpj)) fail(back, "CNPJ inválido. Confira os números.");
  if (!UFS.includes(data.state)) fail(back, "Selecione o estado (UF).");
  if (emails.invalid.length) fail(back, `E-mail inválido: ${emails.invalid.join(", ")}`);
  if (!emails.valid.length) fail(back, "Informe ao menos um e-mail.");
  return { data, emails: emails.valid };
}

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return supabase;
}

export async function createCustomer(form: FormData) {
  const supabase = await session();
  const { data, emails } = readCustomer(form, "/clientes?novo=1");
  const { data: customer, error } = await supabase.from("clients").insert(data).select("id").single();
  if (error || !customer) fail("/clientes?novo=1", error?.code === "23505" ? "Este CNPJ já está cadastrado." : "Não foi possível salvar o cliente.");
  const { error: emailsError } = await supabase.from("client_emails").insert(emails.map((email, index) => ({ client_id: customer!.id, email, is_primary: index === 0 })));
  if (emailsError) fail(`/clientes/${customer!.id}`, "Cliente criado, mas os e-mails não foram salvos. Tente de novo.");
  revalidatePath("/clientes");
  redirect("/clientes?created=1");
}

/** Atualiza dados e e-mails. O primeiro e-mail da lista vira o principal. */
export async function updateCustomer(form: FormData) {
  const supabase = await session();
  const id = String(form.get("id"));
  const back = `/clientes/${id}`;
  const { data, emails } = readCustomer(form, back);
  const { error } = await supabase.from("clients").update(data).eq("id", id);
  if (error) fail(back, error.code === "23505" ? "Outro cliente já usa este CNPJ." : "Não foi possível salvar o cliente.");

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
