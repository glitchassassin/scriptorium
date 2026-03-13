import type { ReactNode } from "react";
import {
  Form,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { ensureStarted } from "~/lib/instances/runtime.server";

export const links: Route.LinksFunction = () => [];

export async function loader() {
  await ensureStarted();
  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-black">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 border-t-2 border-black pt-8">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.08em]">Scriptorium</p>
          <h1 className="text-3xl font-bold">{message}</h1>
          <p className="max-w-2xl text-base leading-6">{details}</p>
        </div>
        <Form action="/logout" method="post">
          <button className="min-h-11 bg-black px-3 py-2 text-base text-white" type="submit">
            Clear session
          </button>
        </Form>
      </div>
      {stack && (
        <pre className="mx-auto mt-8 w-full max-w-3xl overflow-x-auto border-t-2 border-black/50 pt-6 font-mono text-sm leading-6">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
