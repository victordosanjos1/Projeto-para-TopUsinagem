"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
export function SignOut() { const router = useRouter(); return <button className="signout" onClick={async () => { await createClient().auth.signOut(); router.replace("/"); router.refresh(); }}>Sair</button>; }
