import type {
  OpencodeFileDiff,
  OpencodeMessageWithParts,
  OpencodePermissionRequest,
  OpencodeQuestionRequest,
  OpencodeSessionInfo,
  OpencodeSessionStatus,
} from "../../../app/lib/opencode/events.ts";

type SeedSession = {
  diff?: OpencodeFileDiff[];
  info: OpencodeSessionInfo;
  messages?: OpencodeMessageWithParts[];
};

export type FakeDirectorySeed = {
  permissions?: OpencodePermissionRequest[];
  questions?: OpencodeQuestionRequest[];
  sessions?: SeedSession[];
  statuses?: Record<string, OpencodeSessionStatus>;
};

const DEFAULT_FAKE_OPENCODE_URL = "http://127.0.0.1:44556";

function getBaseUrl() {
  return process.env.SCRIPTORIUM_OPENCODE_URL ?? DEFAULT_FAKE_OPENCODE_URL;
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Fake Opencode request failed with ${response.status}`);
  }

  return response;
}

export async function resetFakeOpencode(directory?: string) {
  await postJson("/__admin/reset", directory ? { directory } : {});
}

export async function seedFakeOpencode(directory: string, state: FakeDirectorySeed) {
  await postJson("/__admin/seed", { directory, state });
}

export async function emitFakeOpencodeEvent(directory: string, event: unknown) {
  await postJson("/__admin/event", { directory, event });
}
