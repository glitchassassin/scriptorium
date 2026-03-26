import type { ReactNode } from "react";
import {
  data,
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
import safeArea from "~/styles/safe-area.module.css";
import { ServiceWorkerRegistration } from "~/components/pwa/service-worker-registration";
import { ensureStarted } from "~/lib/instances/runtime.server";
import { APP_NAME, getDocumentTitle, normalizeRouteHandleMatches, resolveRouteHandleValue } from "~/lib/route-handle";
import { getServerTimingHeaders, makeTimings, time } from "~/lib/server-timing.server";

export const links: Route.LinksFunction = () => [
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
  { rel: "icon", href: "/icon-512.png", type: "image/png", sizes: "512x512" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
];

export async function loader() {
  const timings = makeTimings("root loader");

  await time(() => ensureStarted(), {
    desc: "ensure instance runtime started",
    timings,
    type: "runtime",
  });

  return data(null, {
    headers: {
      "Server-Timing": timings.toString(),
    },
  });
}

export function headers(args: Route.HeadersArgs) {
  return getServerTimingHeaders(args);
}

export function getTitleFromMatches(matches: Route.ComponentProps["matches"]) {
  const breadcrumbs = resolveRouteHandleValue(normalizeRouteHandleMatches(matches), "title");

  return getDocumentTitle(breadcrumbs);
}

export function getErrorDocumentTitle(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.status === 404 ? `404 | ${APP_NAME}` : `Error | ${APP_NAME}`;
  }

  return `Error | ${APP_NAME}`;
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta content="#ffffff" name="theme-color" />
        <meta content="yes" name="apple-mobile-web-app-capable" />
        <meta content="default" name="apple-mobile-web-app-status-bar-style" />
        <meta content="Scriptorium" name="apple-mobile-web-app-title" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <ServiceWorkerRegistration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ matches }: Route.ComponentProps) {
  return (
    <>
      <title>{getTitleFromMatches(matches)}</title>
      <Outlet />
    </>
  );
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
    <main className={`${safeArea.pageShell} min-h-dvh bg-white text-black`}>
      <title>{getErrorDocumentTitle(error)}</title>
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
        <pre className="mx-auto mt-8 w-full max-w-3xl overflow-x-auto border-t-2 border-black pt-6 font-mono text-sm leading-6">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
