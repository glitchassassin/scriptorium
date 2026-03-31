import { data } from "react-router";

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { browseProjectFiles, parseSelectedFileLineRange, readProjectFile } from "~/lib/projects/files.server";
import { getProjectOrThrow } from "~/lib/projects/runtime.server";
import { makeTimings, time } from "~/lib/server-timing.server";

export async function loadProjectFilesRouteData({
  projectId,
  request,
}: {
  projectId: string;
  request: Request;
}) {
  const timings = makeTimings("files loader");

  await time(() => requireAuthenticatedPasskey(request), {
    desc: "require authenticated passkey",
    timings,
    type: "auth",
  });

  const project = await time(() => getProjectOrThrow(projectId), {
    desc: "get project",
    timings,
    type: "project",
  });
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const file = url.searchParams.get("file");
  const selectedLineRange = file ? parseSelectedFileLineRange(url.searchParams) : null;
  const listing = await time(() => browseProjectFiles(path, project.directory, "either"), {
    desc: "browse files",
    timings,
    type: "listing",
  });

  let selected = null;
  let selectedError: string | null = null;

  if (file) {
    try {
      selected = await time(() => readProjectFile(file, project.directory), {
        desc: "read selected file",
        timings,
        type: "selected file",
      });
    } catch (error) {
      selectedError = error instanceof Response ? await error.text() : "Failed to read file.";
    }
  }

  return data(
    {
      project,
      listing,
      selected,
      selectedError,
      selectedLineRange,
      selectedPath: file,
    },
    {
      headers: {
        "Server-Timing": timings.toString(),
      },
    },
  );
}
