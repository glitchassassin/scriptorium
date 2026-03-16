import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiffView } from "~/components/session/diff-view";

describe("DiffView", () => {
  it("renders inline diff content without its own collapse control", () => {
    const { container } = render(<DiffView diff={`@@ -0,0 +1,1 @@\n+const value = 1;`} filePath="src/app.ts" />);

    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(container).toHaveTextContent("const value = 1;");
    expect(screen.queryByRole("button", { name: /expand diff/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /collapse diff/i })).not.toBeInTheDocument();
  });
});
