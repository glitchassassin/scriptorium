import type { ReactNode } from "react";
import { Outlet } from "react-router";

import safeArea from "~/styles/safe-area.module.css";

export function AuthShell() {
  return (
    <main className={`${safeArea.pageShell} flex min-h-dvh bg-white text-black`}>
      <div className="mx-auto flex min-h-0 max-w-4xl flex-1 flex-col gap-8">
        <header className="border-b-2 border-black pb-4">
          <p className="text-sm uppercase tracking-[0.08em]">Scriptorium</p>
        </header>
        <section className="max-w-xl self-start">
          <Outlet />
        </section>
      </div>
    </main>
  );
}

export function AuthSection(props: {
  title: string;
  copy: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-3xl font-bold">{props.title}</h2>
        {props.copy ? <p className="max-w-xl text-base leading-6">{props.copy}</p> : null}
      </header>
      {props.children}
      {props.footer ? <footer className="pt-2 text-sm leading-6">{props.footer}</footer> : null}
    </div>
  );
}

export function StatusMessage(props: { message: string | null; tone?: "error" | "muted" }) {
  if (!props.message) {
    return null;
  }

  return (
    <p className={`text-base leading-6 ${props.tone === "muted" ? "opacity-60" : "font-bold"}`}>
      {props.message}
    </p>
  );
}
