"use client";
import { useFormStatus } from "react-dom";

// Botão de envio que se desativa enquanto o servidor processa, evitando clique duplo
// (ex.: finalizar duas vezes). Com name/value, só o botão clicado mostra "pendingLabel".
export function SubmitButton({ children, pendingLabel = "Aguarde...", className = "primary-action", name, value }: {
  children: React.ReactNode; pendingLabel?: string; className?: string; name?: string; value?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button className={className} name={name} value={value} disabled={pending} aria-busy={mine}>
      {mine ? pendingLabel : children}
    </button>
  );
}
