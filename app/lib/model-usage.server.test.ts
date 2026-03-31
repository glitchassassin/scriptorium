// @vitest-environment node

import { describe, expect, it } from "vitest";

import { withTestDatabase } from "~/lib/db.server";
import type { ProjectRecord } from "~/lib/projects/types";
import {
  listRecentModelChoices,
  recordModelUsage,
  resolveSessionModelChoice,
} from "~/lib/model-usage.server";
import type { OpencodeMessageWithParts, OpencodeProvider } from "~/lib/opencode/events";

const instanceA: ProjectRecord = {
  id: "project-a",
  name: "Alpha",
  directory: "/tmp/a",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const instanceB: ProjectRecord = {
  id: "project-b",
  name: "Beta",
  directory: "/tmp/b",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const providers: OpencodeProvider[] = [
  {
    id: "openai",
    models: {
      "gpt-5": {
        id: "gpt-5",
        name: "GPT 5",
        variants: {
          high: {},
          low: {},
        },
      },
      "gpt-5-mini": {
        id: "gpt-5-mini",
        name: "GPT 5 Mini",
      },
    },
    name: "OpenAI",
  },
  {
    id: "anthropic",
    models: {
      "claude-sonnet": {
        id: "claude-sonnet",
        name: "Claude Sonnet",
        variants: {
          high: {},
        },
      },
    },
    name: "Anthropic",
  },
];

function createUserMessage(input: {
  created: number;
  modelID: string;
  providerID: string;
  sessionID?: string;
  variant?: string;
}): OpencodeMessageWithParts {
  return {
    info: {
      id: `message-${input.created}`,
      model: {
        modelID: input.modelID,
        providerID: input.providerID,
      },
      role: "user",
      sessionID: input.sessionID ?? "session-1",
      time: { created: input.created },
      variant: input.variant,
    },
    parts: [],
  };
}

describe("model usage", () => {
  it("prefers current-project recents and keeps the newest variant per model", async () => {
    await withTestDatabase(async () => {
      recordModelUsage({
        projectId: instanceA.id,
        model: { modelID: "gpt-5", providerID: "openai" },
        sessionId: "session-a-1",
        usedAt: 100,
        variant: "low",
      });
      recordModelUsage({
        projectId: instanceA.id,
        model: { modelID: "claude-sonnet", providerID: "anthropic" },
        sessionId: "session-a-2",
        usedAt: 150,
        variant: "high",
      });
      recordModelUsage({
        projectId: instanceA.id,
        model: { modelID: "gpt-5", providerID: "openai" },
        sessionId: "session-a-3",
        usedAt: 200,
        variant: "high",
      });
      recordModelUsage({
        projectId: instanceB.id,
        model: { modelID: "gpt-5", providerID: "openai" },
        sessionId: "session-b-1",
        usedAt: 300,
        variant: "low",
      });
      recordModelUsage({
        projectId: instanceB.id,
        model: { modelID: "gpt-5-mini", providerID: "openai" },
        sessionId: "session-b-2",
        usedAt: 250,
      });

    await expect(listRecentModelChoices({ project: instanceA, providers, limit: 3 })).resolves.toEqual([
        {
          model: { modelID: "gpt-5", providerID: "openai" },
          usedAt: 200,
          variant: "high",
        },
        {
          model: { modelID: "claude-sonnet", providerID: "anthropic" },
          usedAt: 150,
          variant: "high",
        },
        {
          model: { modelID: "gpt-5-mini", providerID: "openai" },
          usedAt: 250,
          variant: null,
        },
      ]);
    });
  });

  it("prefers current session messages before config and stored recents", async () => {
    await withTestDatabase(async () => {
      recordModelUsage({
        projectId: instanceA.id,
        model: { modelID: "claude-sonnet", providerID: "anthropic" },
        sessionId: "session-a-2",
        usedAt: 150,
        variant: "high",
      });

    await expect(resolveSessionModelChoice({
        configModel: "openai/gpt-5-mini",
        project: instanceA,
        messages: [createUserMessage({ created: 500, modelID: "gpt-5", providerID: "openai", variant: "high" })],
        providers,
        sessionId: "session-1",
      })).resolves.toEqual({
        model: { modelID: "gpt-5", providerID: "openai" },
        variant: "high",
      });
    });
  });

  it("prefers config models before project and global recents", async () => {
    await withTestDatabase(async () => {
      recordModelUsage({
        projectId: instanceA.id,
        model: { modelID: "claude-sonnet", providerID: "anthropic" },
        sessionId: "session-a-2",
        usedAt: 150,
        variant: "high",
      });
      recordModelUsage({
        projectId: instanceB.id,
        model: { modelID: "gpt-5", providerID: "openai" },
        sessionId: "session-b-1",
        usedAt: 300,
        variant: "low",
      });

      await expect(resolveSessionModelChoice({
        configModel: "openai/gpt-5-mini",
        project: instanceA,
        messages: [],
        providers,
        sessionId: "session-1",
      })).resolves.toEqual({
        model: { modelID: "gpt-5-mini", providerID: "openai" },
        variant: null,
      });
    });
  });
});
