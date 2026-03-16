import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PermissionCard } from "~/components/session/permission-card";
import type { OpencodePermissionRequest } from "~/lib/opencode/events";

describe("PermissionCard", () => {
  it("renders a shared Permission card with grouped requests", () => {
    const permissions: OpencodePermissionRequest[] = [
      {
        id: "permission-1",
        sessionID: "session-1",
        permission: "read",
        patterns: ["src/app.ts"],
        metadata: {},
        always: [],
      },
      {
        id: "permission-2",
        sessionID: "session-1",
        permission: "glob",
        patterns: [],
        metadata: { pattern: "app/**/*.tsx" },
        always: [],
      },
    ];

    const { container } = render(
      <PermissionCard messages={[]} onReply={vi.fn()} permissions={permissions} />,
    );

    expect(screen.getByText("Review Actions")).toBeInTheDocument();
    expect(screen.getByText("Appr")).toBeInTheDocument();
    expect(screen.getByText("Alwy")).toBeInTheDocument();
    expect(screen.getByText("Deny")).toBeInTheDocument();
    expect(screen.getByText("read: src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("glob: app/**/*.tsx")).toBeInTheDocument();
    expect(container.querySelectorAll(".border-t-2.border-black")).toHaveLength(1);
  });

  it("renders nothing when no permissions are pending", () => {
    const { container } = render(
      <PermissionCard messages={[]} onReply={vi.fn()} permissions={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
