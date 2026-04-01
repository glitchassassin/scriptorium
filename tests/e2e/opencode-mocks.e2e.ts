import path from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import type {
  OpencodeMessageWithParts,
  OpencodePermissionRequest,
  OpencodeQuestionRequest,
  OpencodeSessionInfo,
} from "../../app/lib/opencode/events.ts";
import { resetFakeOpencode, seedFakeOpencode } from "./support/fake-opencode-client";

const alphaDirectory = path.resolve("tests/e2e/fixtures/workspaces/alpha");

function createSessionInfo(input: {
  created: number;
  id: string;
  title?: string;
  updated?: number;
}) {
  return {
    directory: alphaDirectory,
    id: input.id,
    ...(input.title ? { title: input.title } : {}),
    time: {
      created: input.created,
      updated: input.updated ?? input.created,
    },
  } satisfies OpencodeSessionInfo;
}

function createUserMessage(input: { created: number; id: string; sessionId: string; text: string }) {
  return {
    info: {
      id: input.id,
      role: "user",
      sessionID: input.sessionId,
      time: { created: input.created },
    },
    parts: [
      {
        id: `part-${input.id}`,
        messageID: input.id,
        sessionID: input.sessionId,
        text: input.text,
        type: "text",
      },
    ],
  } satisfies OpencodeMessageWithParts;
}

function createAssistantMessage(input: {
  created: number;
  id: string;
  parentId: string;
  sessionId: string;
  text: string;
}) {
  return {
    info: {
      id: input.id,
      parentID: input.parentId,
      providerID: "openai",
      role: "assistant",
      sessionID: input.sessionId,
      time: {
        completed: input.created,
        created: input.created,
      },
    },
    parts: [
      {
        id: `part-${input.id}`,
        messageID: input.id,
        sessionID: input.sessionId,
        text: input.text,
        type: "text",
      },
    ],
  } satisfies OpencodeMessageWithParts;
}

async function createProject(page: Page, name: string) {
  await page.goto("/projects/new");
  await page.getByRole("button", { exact: true, name: "alpha/" }).click();
  await page.getByRole("textbox", { name: "Folder name" }).fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);

  const parts = page.url().split("/").filter(Boolean);
  const projectId = parts[parts.length - 1];

  if (!projectId) {
    throw new Error("Failed to read project id from URL.");
  }

  return projectId;
}

async function openSeededSession(page: Page, sessionTitle: string) {
  await page.getByRole("link", { name: new RegExp(sessionTitle) }).click();
  await expect(page).toHaveURL(/\/sessions\/session-1/);
}

test.beforeEach(async () => {
  await resetFakeOpencode(alphaDirectory);
});

test("creates a project and starts a session against the fake backend", async ({ page }: { page: Page }, testInfo: TestInfo) => {
  await createProject(page, `Alpha ${testInfo.title}`);
  await expect(page.getByText("No Opencode sessions were found for this project.")).toBeVisible();

  await page.getByText("New session", { exact: true }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/sessions\/session-1$/);
  await expect(page.getByPlaceholder("Send a message, paste an image, or attach one")).toBeVisible();
});

test("streams prompt replies through the fake Opencode SSE server", async ({ page }: { page: Page }, testInfo: TestInfo) => {
  await createProject(page, `Prompt ${testInfo.title}`);
  await page.getByText("New session", { exact: true }).click();

  await page.getByPlaceholder("Send a message, paste an image, or attach one").fill("Hello from Playwright");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("Hello from Playwright")).toBeVisible();
  await expect(page.getByText("Echo: Hello from Playwright")).toBeVisible();
});

test("loads and resolves seeded permission and question requests", async ({ page }: { page: Page }, testInfo: TestInfo) => {
  const session = createSessionInfo({ created: 10, id: "session-1", title: "Review queue", updated: 20 });
  const permission = {
    always: [],
    id: "permission-1",
    metadata: {
      description: "cat README.md",
    },
    patterns: [],
    permission: "bash",
    sessionID: session.id,
  } satisfies OpencodePermissionRequest;
  const question = {
    id: "question-1",
    questions: [
      {
        custom: true,
        header: "Next step",
        options: [
          { description: "Run the test suite", label: "Tests" },
          { description: "Ship the change", label: "Ship it" },
        ],
        question: "What should happen next?",
      },
    ],
    sessionID: session.id,
  } satisfies OpencodeQuestionRequest;

  await seedFakeOpencode(alphaDirectory, {
    permissions: [permission],
    questions: [question],
    sessions: [{ info: session, messages: [createUserMessage({ created: 11, id: "message-1", sessionId: session.id, text: "Review this" })] }],
    statuses: { [session.id]: { type: "idle" } },
  });

  await createProject(page, `Review ${testInfo.title}`);
  await openSeededSession(page, "Review queue");

  await expect(page.getByText("Review Actions")).toBeVisible();
  await expect(page.getByText("Answer Questions")).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Approve permission" }).click();
  await expect(page.getByText("bash: cat README.md")).toHaveCount(0);

  await page.getByRole("button", { name: /Tests/ }).click();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText("What should happen next?")).toHaveCount(0);
});

test("supports revert and fork flows with seeded session history", async ({ page }: { page: Page }, testInfo: TestInfo) => {
  const session = createSessionInfo({ created: 10, id: "session-1", title: "Prompt history", updated: 40 });

  await seedFakeOpencode(alphaDirectory, {
    sessions: [
      {
        info: session,
        messages: [
          createUserMessage({ created: 11, id: "message-1", sessionId: session.id, text: "First prompt" }),
          createAssistantMessage({ created: 12, id: "message-2", parentId: "message-1", sessionId: session.id, text: "Echo: First prompt" }),
          createUserMessage({ created: 13, id: "message-3", sessionId: session.id, text: "Second prompt" }),
          createAssistantMessage({ created: 14, id: "message-4", parentId: "message-3", sessionId: session.id, text: "Echo: Second prompt" }),
        ],
      },
    ],
    statuses: { [session.id]: { type: "idle" } },
  });

  await createProject(page, `History ${testInfo.title}`);
  await openSeededSession(page, "Prompt history");

  await page.locator("article").filter({ hasText: "Second prompt" }).getByLabel("Undo from this message").click();
  await expect(page.getByText("Reverted messages")).toBeVisible();
  await expect(page.getByLabel("Redo from message Second prompt")).toBeVisible();

  await page.getByLabel("Redo from message Second prompt").click();
  await expect(page.getByText("Reverted messages")).toHaveCount(0);

  await page.locator("article").filter({ hasText: "First prompt" }).getByLabel("Fork from this message").click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/sessions\/session-2\?prompt=/);
  await expect(page.getByPlaceholder("Send a message, paste an image, or attach one")).toHaveValue("First prompt");
});
