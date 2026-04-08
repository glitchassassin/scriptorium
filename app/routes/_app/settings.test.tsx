import type { ComponentProps, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SettingsRoute from "~/routes/_app/settings";

vi.mock("~/lib/auth/guards.server", () => ({
  requireAuthenticatedPasskey: vi.fn(),
}));

vi.mock("~/lib/opencode/shared-runtime.server", () => ({
  getSharedOpencodeRuntimeStatus: vi.fn(),
}));

vi.mock("react-router", () => ({
  Link: ({ children, className, to }: { children: ReactNode; className?: string; to: string }) => (
    <a className={className} data-to={to} href={to}>
      {children}
    </a>
  ),
}));

vi.mock("~/components/shell/breadcrumbs", () => ({
  Breadcrumbs: Object.assign(() => null, {
    Item: () => null,
  }),
}));

vi.mock("~/components/shell/scrollable-layout", () => ({
  ScrollableLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("SettingsRoute", () => {
  it("shows an unread indicator on the OpenCode section when a restart is required", () => {
    const props = { loaderData: { opencodeRestartRequired: true }, matches: [] } as unknown as ComponentProps<typeof SettingsRoute>;

    render(<SettingsRoute {...props} />);

    expect(screen.getByRole("link", { name: /opencode/i }).querySelector('[data-testid="unread-badge"]')).not.toBeNull();
  });

  it("hides the unread indicator when OpenCode is up to date", () => {
    const props = { loaderData: { opencodeRestartRequired: false }, matches: [] } as unknown as ComponentProps<typeof SettingsRoute>;

    render(<SettingsRoute {...props} />);

    expect(screen.getByRole("link", { name: /opencode/i }).querySelector('[data-testid="unread-badge"]')).toBeNull();
  });
});
