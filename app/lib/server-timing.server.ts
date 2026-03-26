export type Timings = Record<
  string,
  Array<
    { desc?: string } & (
      | { time: number; start?: never }
      | { time?: never; start: number }
    )
  >
>;

type TimingHeadersArgs = {
  actionHeaders?: Headers;
  errorHeaders?: Headers;
  loaderHeaders?: Headers;
  parentHeaders?: Headers;
};

export function makeTimings(type: string, desc?: string) {
  const timings: Timings = {
    [type]: [{ desc, start: performance.now() }],
  };

  Object.defineProperty(timings, "toString", {
    enumerable: false,
    value() {
      return getServerTimingHeader(timings);
    },
  });

  return timings;
}

function createTimer(type: string, desc?: string) {
  const start = performance.now();

  return {
    end(timings: Timings) {
      let entries = timings[type];

      if (!entries) {
        entries = timings[type] = [];
      }

      entries.push({ desc, time: performance.now() - start });
    },
  };
}

export async function time<ReturnValue>(
  fn: Promise<ReturnValue> | (() => ReturnValue | Promise<ReturnValue>),
  {
    desc,
    timings,
    type,
  }: {
    desc?: string;
    timings?: Timings;
    type: string;
  },
): Promise<ReturnValue> {
  const timer = createTimer(type, desc);
  const promise = typeof fn === "function" ? Promise.resolve().then(fn) : Promise.resolve(fn);

  if (!timings) {
    return promise;
  }

  try {
    return await promise;
  } finally {
    timer.end(timings);
  }
}

export function getServerTimingHeader(timings?: Timings) {
  if (!timings) {
    return "";
  }

  return Object.entries(timings)
    .map(([key, entries]) => {
      const duration = entries
        .reduce((total, entry) => total + (entry.time ?? performance.now() - entry.start), 0)
        .toFixed(1);
      const description = entries
        .map((entry) => entry.desc)
        .filter((value): value is string => Boolean(value))
        .join(" & ");

      return [
        key.replaceAll(/(:| |@|=|;|,|\/|\\)/g, "_"),
        description ? `desc=${JSON.stringify(description)}` : null,
        `dur=${duration}`,
      ]
        .filter(Boolean)
        .join(";");
    })
    .join(",");
}

function hasAnyHeaders(headers?: Headers) {
  return Boolean(headers && !headers.entries().next().done);
}

function appendServerTimingHeader(target: Headers, source?: Headers) {
  const value = source?.get("Server-Timing");

  if (value) {
    target.append("Server-Timing", value);
  }

  return target;
}

export function getServerTimingHeaders({
  actionHeaders,
  errorHeaders,
  loaderHeaders,
  parentHeaders,
}: TimingHeadersArgs) {
  const headers = new Headers();
  const currentHeaders = errorHeaders ?? (hasAnyHeaders(loaderHeaders) ? loaderHeaders : actionHeaders);

  appendServerTimingHeader(headers, currentHeaders);
  appendServerTimingHeader(headers, parentHeaders);

  return headers;
}
