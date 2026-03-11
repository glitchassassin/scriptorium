import { render, screen } from "@testing-library/react";

import Home from "./home";

describe("Home route", () => {
  it("renders the starter welcome links", () => {
    render(<Home />);

    expect(screen.getByText("What's next?")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /react router docs/i }),
    ).toHaveAttribute("href", "https://reactrouter.com/docs");
  });
});
