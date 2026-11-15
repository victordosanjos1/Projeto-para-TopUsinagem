import Link from "next/link";
import { SignOut } from "@/app/dashboard/sign-out";
import { SideNav } from "@/app/components/side-nav";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="TOP Usinagem - Painel">
          TOP <span>USINAGEM</span>
          <small>ELETROEROSÃO A FIO</small>
        </Link>
        <SideNav />
        <div className="side-foot">
          <span>Área interna</span>
          <SignOut />
        </div>
      </aside>
      <main className="main">
        <header className="topbar"><strong>{title}</strong></header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
