"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Painel", match: ["/dashboard"] },
  { href: "/clientes", label: "Clientes", match: ["/clientes"] },
  { href: "/orcamentos/lista", label: "Orçamentos", match: ["/orcamentos"] },
  { href: "/configuracoes", label: "Configurações", match: ["/configuracoes"] },
];

// Marca o item do menu da seção atual (ex.: /orcamentos/123 destaca "Orçamentos").
export function SideNav() {
  const path = usePathname();
  return (
    <nav className="side-nav" aria-label="Menu principal">
      {LINKS.map(link => {
        const active = link.match.some(m => path === m || path.startsWith(`${m}/`));
        return <Link key={link.href} href={link.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{link.label}</Link>;
      })}
    </nav>
  );
}
