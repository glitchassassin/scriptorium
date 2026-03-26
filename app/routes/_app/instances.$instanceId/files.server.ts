import { data } from "react-router";

import { requireAuthenticatedPasskey } from "~/lib/auth/guards.server";
import { browseInstanceFiles, readInstanceFile } from "~/lib/instances/files.server";
import { getInstanceOrThrow } from "~/lib/instances/runtime.server";
import { makeTimings, time } from "~/lib/server-timing.server";

export async function loadInstanceFilesRouteData({
  instanceId,
  request,
}: {
  instanceId: string;
  request: Request;
}) {
  const timings = makeTimings("files loader");

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
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const file = url.searchParams.get("file");
  const listing = await time(() => browseInstanceFiles(path, instance.directory, "either"), {
    desc: "browse files",
    timings,
    type: "listing",
  });

  let selected = null;
  let selectedError: string | null = null;

  if (file) {
    try {
      selected = await time(() => readInstanceFile(file, instance.directory), {
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
      instance,
      listing,
      selected,
      selectedError,
      selectedPath: file,
    },
    {
      headers: {
        "Server-Timing": timings.toString(),
      },
    },
  );
}
