"use client";
import { type ReactNode } from "react";

export function FormEnterNext({ children }: { children: ReactNode }) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    const form = target.closest("form"); if (!form) return;
    const fields = [...form.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')];
    const index = fields.indexOf(target); if (index < 0) return;
    event.preventDefault(); fields[(index + 1) % fields.length]?.focus();
  }
  return <div onKeyDown={onKeyDown}>{children}</div>;
}
