import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderRuntimeConfigurationMarkdown } from "../app/lib/runtime-config.server.ts";

const outputPath = fileURLToPath(new URL("../docs/config.md", import.meta.url));

writeFileSync(outputPath, `${renderRuntimeConfigurationMarkdown()}\n`, "utf8");
