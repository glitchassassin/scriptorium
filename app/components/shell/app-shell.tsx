import { Form, Link, Outlet } from "react-router";

type AppShellProps = {
  passkeyLabel: string;
};

export function AppShell({ passkeyLabel }: AppShellProps) {
  return (
    <main className="min-h-screen bg-white px-6 py-8 text-black sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-t-2 border-black pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.08em]">Authenticated workspace</p>
            <h1 className="text-3xl font-bold">Scriptorium is unlocked.</h1>
            <p className="max-w-2xl text-base leading-6">
              Signed in with <span className="font-bold">{passkeyLabel}</span>. The
              instance and session workspace can land here once auth is complete.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center justify-center px-3 py-2 text-base text-black underline underline-offset-4" to="/register">
              Add another device
            </Link>
            <Form action="/logout" method="post">
              <button className="inline-flex min-h-11 items-center justify-center bg-black px-3 py-2 text-base text-white" type="submit">
                Log out
              </button>
            </Form>
          </div>
        </header>
        <section className="grid gap-6 border-t-2 border-black/50 pt-6 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
          <aside className="space-y-3 text-sm leading-6">
            <p className="text-sm uppercase tracking-[0.08em]">Next phase</p>
            <p>Instances, sessions, and stream routing will replace this placeholder next.</p>
          </aside>
          <section className="space-y-4">
            <Outlet />
          </section>
        </section>
      </div>
    </main>
  );
}
