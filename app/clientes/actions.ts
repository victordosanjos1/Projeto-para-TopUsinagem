"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCustomer(formData: FormData) {
  const companyName = String(formData.get("company_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const cnpj = String(formData.get("cnpj") ?? "").replace(/\D/g, "");
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const country = String(formData.get("country") ?? "Brasil").trim();
  const emails = String(formData.get("emails") ?? "").split(/[;,\n]/).map(email => email.trim().toLowerCase()).filter(Boolean);
  if (!companyName || !contactName || !city || !state || !country || cnpj.length !== 14 || !emails.length) redirect("/clientes?error=Dados+obrigatorios+invalidos");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: customer, error } = await supabase.from("clients").insert({ company_name: companyName, contact_name: contactName, cnpj, city, state, country }).select("id").single();
  if (error || !customer) redirect(`/clientes?error=${encodeURIComponent(error?.code === "23505" ? "Este CNPJ ja esta cadastrado." : "Nao foi possivel salvar o cliente.")}`);
  const { error: emailsError } = await supabase.from("client_emails").insert(emails.map((email, index) => ({ client_id: customer.id, email, is_primary: index === 0 })));
  if (emailsError) redirect("/clientes?error=Cliente+criado,+mas+os+e-mails+nao+foram+salvos.");
  redirect("/clientes?created=1");
}

export async function toggleCustomerStatus(formData: FormData) {
  const id = String(formData.get("id")); const active = String(formData.get("active")) === "true";
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/");
  await supabase.from("clients").update({ is_active: !active }).eq("id", id);
  redirect("/clientes");
}
