import { FormEnterNext } from "@/app/components/form-enter-next";
import { UFS, formatCnpj } from "@/lib/br";

export type Customer = { id: string; company_name: string; contact_name: string; cnpj: string; city: string; state: string; country: string; emails: string[] };

export function CustomerForm({ action, customer, submitLabel }: { action: (form: FormData) => Promise<void>; customer?: Customer; submitLabel: string }) {
  return (
    <FormEnterNext>
      <form action={action} className="customer-form">
        {customer && <input type="hidden" name="id" value={customer.id} />}
        <label className="full">Empresa *<input name="company_name" required defaultValue={customer?.company_name} autoComplete="organization" /></label>
        <label>Responsável *<input name="contact_name" required defaultValue={customer?.contact_name} autoComplete="name" /></label>
        <label>CNPJ *<input name="cnpj" required defaultValue={customer ? formatCnpj(customer.cnpj) : ""} inputMode="numeric" placeholder="00.000.000/0000-00" pattern="[0-9./\-\s]{14,20}" title="14 números do CNPJ" /></label>
        <label>Cidade *<input name="city" required defaultValue={customer?.city} autoComplete="address-level2" /></label>
        <label>Estado *
          <select name="state" required defaultValue={customer?.state ?? "SC"}>
            {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </label>
        <label className="full">País *<input name="country" required defaultValue={customer?.country ?? "Brasil"} /></label>
        <label className="full">E-mails *
          <textarea name="emails" required defaultValue={customer?.emails.join("\n")} placeholder={"compras@empresa.com.br\nengenharia@empresa.com.br"} />
          <small className="field-hint">Um por linha. O primeiro é o principal e vem marcado no envio.</small>
        </label>
        <button className="primary-action">{submitLabel}</button>
      </form>
    </FormEnterNext>
  );
}
