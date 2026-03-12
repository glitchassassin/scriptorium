export default function AppIndexRoute() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3 border-t-2 border-black pt-4">
        <p className="text-sm uppercase tracking-[0.08em]">Auth status</p>
        <p className="text-base leading-6">
          Cookie-backed sessions, public registration, and console-confirmed passkey activation are in place.
        </p>
      </section>
      <section className="space-y-3 border-t-2 border-black pt-4">
        <p className="text-sm uppercase tracking-[0.08em]">Workspace placeholder</p>
        <p className="text-base leading-6">
          Instance management, sessions, and streaming output can now build on top of this authenticated shell.
        </p>
      </section>
    </div>
  );
}
