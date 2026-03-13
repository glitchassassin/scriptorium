import { describe, expect, it } from "vitest";

import { detectCodeLanguage } from "~/lib/files/language";

describe("detectCodeLanguage", () => {
  it("maps file extensions to Prism language names", () => {
    expect(detectCodeLanguage("app/index.tsx")).toBe("tsx");
    expect(detectCodeLanguage("server/.eslintrc.json")).toBe("json");
    expect(detectCodeLanguage("Dockerfile")).toBe("docker");
  });

  it("uses shebang hints when extension is unavailable", () => {
    expect(detectCodeLanguage("script", "#!/usr/bin/env python3")).toBe("python");
  });
});
