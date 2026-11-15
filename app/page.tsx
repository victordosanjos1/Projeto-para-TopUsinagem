"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
export default function Home() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false); const router = useRouter();
  async function signIn() { setLoading(true); setMessage(""); const { error } = await createClient().auth.signInWithPassword({ email, password }); if (error) { setMessage("Nao foi possivel entrar. Confira e-mail e senha."); setLoading(false); return; } router.push("/dashboard"); router.refresh(); }
  return <main className="login"><section className="login-card"><img src="/logo-top-usinagem.png" alt="TOP Usinagem" /><h1>Sistema interno</h1><p>Gestao de clientes e orcamentos.</p><label>E-mail de acesso<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@topusinagem.com" /></label><label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" /></label>{message && <p className="form-error">{message}</p>}<button disabled={loading} onClick={signIn}>{loading ? "Entrando..." : "Entrar"}</button><small>O acesso sera liberado apenas por convite da administracao.</small></section></main>;
}
