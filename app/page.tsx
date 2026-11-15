"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function Login() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    const { error } = await createClient().auth.signInWithPassword({ email: String(form.get("email")).trim(), password: String(form.get("password")) });
    if (error) {
      setMessage(/rate|too many/i.test(error.message) ? "Muitas tentativas. Aguarde alguns minutos e tente de novo." : "Não foi possível entrar. Confira o e-mail e a senha.");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={signIn}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-top-usinagem.png" alt="TOP Usinagem" />
        <h1>Sistema interno</h1>
        <p>Gestão de clientes e orçamentos.</p>
        <label>E-mail de acesso<input name="email" type="email" required autoComplete="username" autoFocus placeholder="voce@topusinagem.com" /></label>
        <label>Senha<input name="password" type="password" required autoComplete="current-password" placeholder="Sua senha" /></label>
        {message && <p className="form-error" role="alert">{message}</p>}
        <button disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        <small>O acesso é liberado apenas por convite da administração.</small>
      </form>
    </main>
  );
}
