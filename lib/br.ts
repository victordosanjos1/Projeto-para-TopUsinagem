export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export const onlyDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export const formatCnpj = (value: unknown) => onlyDigits(value).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

/** Confere os dígitos verificadores do CNPJ. */
export function isValidCnpj(value: unknown): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(cnpj[i]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function parseEmails(value: unknown): { valid: string[]; invalid: string[] } {
  const all = [...new Set(String(value ?? "").split(/[;,\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean))];
  return { valid: all.filter(e => EMAIL_PATTERN.test(e)), invalid: all.filter(e => !EMAIL_PATTERN.test(e)) };
}
