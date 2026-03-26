import { data } from "react-router";

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { getGitChangedFiles, getGitFileDiff, getGitStatusSummary } from "~/lib/instances/git.server";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";
import { makeTimings, time } from "~/lib/server-timing.server";

export async function loadInstanceGitRouteData({
  instanceId,
  request,
}: {
  instanceId: string;
  request: Request;
}) {
  const timings = makeTimings("git loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  const instance = await time(() => getInstanceOrThrow(instanceId), {
    desc: "get instance",
    timings,
    type: "instance",
  });
  const git = await time(() => getGitStatusSummary(instance.directory), {
    desc: "get git summary",
    timings,
    type: "git summary",
  });
  const changed = await time(() => getGitChangedFiles(instance.directory), {
    desc: "get changed files",
    timings,
    type: "changed files",
  });
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  let selected = null;
  let selectedError: string | null = null;

  if (path && changed.isRepository) {
    try {
      const result = await time(() => getGitFileDiff(instance.directory, path), {
        desc: "get selected diff",
        timings,
        type: "selected diff",
      });
      selected = result.isRepository ? result : null;
    } catch (error) {
      selectedError = error instanceof Response ? await error.text() : "Failed to load file diff.";
    }
  }

  return data(
    {
      changed,
      git,
      instance,
      selected,
      selectedError,
      selectedPath: path,
    },
    {
      headers: {
        "Server-Timing": timings.toString(),
      },
    },
  );
}
