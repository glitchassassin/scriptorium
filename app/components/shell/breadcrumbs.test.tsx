import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Breadcrumbs, BreadcrumbsProvider, useBreadcrumbs } from "~/components/shell/breadcrumbs";

function BreadcrumbsConsumer() {
  const breadcrumbs = useBreadcrumbs();

  return <div data-testid="breadcrumbs">{breadcrumbs.map((breadcrumb) => String(breadcrumb.content)).join(" / ")}</div>;
}

describe("Breadcrumbs", () => {
  it("uses the deepest registered breadcrumb set", () => {
    render(
      <BreadcrumbsProvider>
        <Breadcrumbs depth={2}>
          <Breadcrumbs.Item>Instances</Breadcrumbs.Item>
        </Breadcrumbs>
        <Breadcrumbs depth={3}>
          <Breadcrumbs.Item>Instance</Breadcrumbs.Item>
          <Breadcrumbs.Item>git</Breadcrumbs.Item>
        </Breadcrumbs>
        <BreadcrumbsConsumer />
      </BreadcrumbsProvider>,
    );

    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("Instance / git");
  });

  it("uses the most recently mounted set when depths match", () => {
    render(
      <BreadcrumbsProvider>
        <Breadcrumbs depth={2}>
          <Breadcrumbs.Item>First</Breadcrumbs.Item>
        </Breadcrumbs>
        <Breadcrumbs depth={2}>
          <Breadcrumbs.Item>Second</Breadcrumbs.Item>
        </Breadcrumbs>
        <BreadcrumbsConsumer />
      </BreadcrumbsProvider>,
    );

    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("Second");
  });

  it("updates active breadcrumbs when item content changes", () => {
    function TestRoute() {
      const [label, setLabel] = useState("Draft");

      return (
        <>
          <button onClick={() => setLabel("Renamed")} type="button">Rename</button>
          <Breadcrumbs depth={3}>
            <Breadcrumbs.Item>Instance</Breadcrumbs.Item>
            <Breadcrumbs.Item>{label}</Breadcrumbs.Item>
            <Breadcrumbs.Item>git</Breadcrumbs.Item>
          </Breadcrumbs>
        </>
      );
    }

    render(
      <BreadcrumbsProvider>
        <TestRoute />
        <BreadcrumbsConsumer />
      </BreadcrumbsProvider>,
    );

    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("Instance / Draft / git");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("Instance / Renamed / git");
  });
});
