import { render, screen } from "@testing-library/react";

import { AuthSection } from "~/components/auth/auth-shell";

describe("AuthSection", () => {
  it("renders minimal auth copy", () => {
    render(
      <AuthSection copy="Quiet access control." title="Register the first passkey">
        <button type="button">Register passkey</button>
      </AuthSection>,
    );

    expect(screen.getByText("Register the first passkey")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register passkey/i })).toBeInTheDocument();
  });
});
