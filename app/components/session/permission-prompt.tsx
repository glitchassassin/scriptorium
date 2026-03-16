import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { CodeViewer } from "~/components/files/code-viewer";
import { DiffView } from "~/components/session/diff-view";
import type { OpencodeMessageWithParts, OpencodePermissionRequest, OpencodeToolPart } from "~/lib/opencode/events";

type PermissionPromptProps = {
  messages: OpencodeMessageWithParts[];
  permission: OpencodePermissionRequest;
  onReply: (requestId: string, reply: "once" | "always" | "reject") => void;
};

function getText(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getToolInput(permission: OpencodePermissionRequest, messages: OpencodeMessageWithParts[]) {
  if (!permission.tool) {
    return undefined;
  }

  const message = messages.find((entry) => entry.info.id === permission.tool?.messageID);

  if (!message) {
    return undefined;
  }

  const part = message.parts.find((entry): entry is OpencodeToolPart => {
    if (entry.type !== "tool") {
      return false;
    }

    return entry.callID === permission.tool?.callID && entry.state.status !== "pending";
  });

  return part?.state.input;
}

function PermissionMeta({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-6">
      <span className="font-bold">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function PermissionCode({ code, language }: { code?: string; language: "bash" | "json" | "markdown" }) {
  if (!code) {
    return null;
  }

  return (
    <CodeViewer
      content={code}
      language={language}
      showDiffMarkers={false}
      showScrollIndicator={false}
    />
  );
}

function PermissionDetails({ messages, permission }: { messages: OpencodeMessageWithParts[]; permission: OpencodePermissionRequest }) {
  const metadata = permission.metadata || {};
  const input = getToolInput(permission, messages) || {};
  const filepath = getText(metadata.filepath);
  const parentDir = getText(metadata.parentDir);
  const path = getText(metadata.path) || getText(input.path);
  const filePath = getText(input.filePath);
  const pattern = getText(metadata.pattern) || getText(input.pattern);
  const include = getText(metadata.include) || getText(input.include);
  const description = getText(metadata.description) || getText(input.description);
  const command = getText(input.command);
  const workdir = getText(input.workdir);
  const subagent = getText(metadata.subagent_type) || getText(input.subagent_type);
  const prompt = getText(input.prompt);
  const url = getText(metadata.url) || getText(input.url);
  const format = getText(metadata.format) || getText(input.format);
  const query = getText(metadata.query) || getText(input.query);
  const timeout = getNumber(metadata.timeout) || getNumber(input.timeout);
  const offset = getNumber(input.offset);
  const limit = getNumber(input.limit);
  const numResults = getNumber(metadata.numResults) || getNumber(input.numResults);
  const tokensNum = getNumber(metadata.tokensNum) || getNumber(input.tokensNum);
  const contextMaxCharacters = getNumber(metadata.contextMaxCharacters) || getNumber(input.contextMaxCharacters);
  const livecrawl = getBoolean(metadata.livecrawl) ?? getBoolean(input.livecrawl);
  const searchType = getText(metadata.type) || getText(input.type);
  const doomTool = getText(metadata.tool);
  const doomInput = getObject(metadata.input);
  const diff = getText(metadata.diff);
  const showPatterns = !new Set([
    "read",
    "glob",
    "grep",
    "list",
    "bash",
    "task",
    "webfetch",
    "websearch",
    "codesearch",
    "external_directory",
    "doom_loop",
  ]).has(permission.permission);

  return (
    <div className="space-y-3">
      {description ? <p className="text-sm leading-6 opacity-80">{description}</p> : null}
      {permission.permission === "read" ? (
        <div className="space-y-1">
          <PermissionMeta label="Path" value={filePath || permission.patterns[0]} />
          <PermissionMeta label="Offset" value={offset !== undefined ? String(offset) : undefined} />
          <PermissionMeta label="Limit" value={limit !== undefined ? String(limit) : undefined} />
        </div>
      ) : null}
      {permission.permission === "glob" ? (
        <div className="space-y-1">
          <PermissionMeta label="Pattern" value={pattern} />
          <PermissionMeta label="Path" value={path} />
        </div>
      ) : null}
      {permission.permission === "grep" ? (
        <div className="space-y-1">
          <PermissionMeta label="Pattern" value={pattern} />
          <PermissionMeta label="Path" value={path} />
          <PermissionMeta label="Include" value={include} />
        </div>
      ) : null}
      {permission.permission === "list" ? (
        <div className="space-y-1">
          <PermissionMeta label="Path" value={path || permission.patterns[0]} />
        </div>
      ) : null}
      {permission.permission === "bash" ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <PermissionMeta label="Workdir" value={workdir} />
            <PermissionMeta label="Timeout" value={timeout !== undefined ? `${timeout} ms` : undefined} />
          </div>
          <PermissionCode code={command} language="bash" />
        </div>
      ) : null}
      {permission.permission === "task" ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <PermissionMeta label="Agent" value={subagent} />
            <PermissionMeta label="Task" value={description} />
          </div>
          <PermissionCode code={prompt} language="markdown" />
        </div>
      ) : null}
      {permission.permission === "webfetch" ? (
        <div className="space-y-1">
          <PermissionMeta label="URL" value={url} />
          <PermissionMeta label="Format" value={format} />
          <PermissionMeta label="Timeout" value={timeout !== undefined ? `${timeout}s` : undefined} />
        </div>
      ) : null}
      {permission.permission === "websearch" ? (
        <div className="space-y-1">
          <PermissionMeta label="Query" value={query} />
          <PermissionMeta label="Results" value={numResults !== undefined ? String(numResults) : undefined} />
          <PermissionMeta label="Type" value={searchType} />
          <PermissionMeta label="Livecrawl" value={livecrawl !== undefined ? (livecrawl ? "yes" : "no") : undefined} />
          <PermissionMeta label="Context" value={contextMaxCharacters !== undefined ? String(contextMaxCharacters) : undefined} />
        </div>
      ) : null}
      {permission.permission === "codesearch" ? (
        <div className="space-y-1">
          <PermissionMeta label="Query" value={query} />
          <PermissionMeta label="Tokens" value={tokensNum !== undefined ? String(tokensNum) : undefined} />
        </div>
      ) : null}
      {permission.permission === "external_directory" ? (
        <div className="space-y-1">
          <PermissionMeta label="Target" value={filepath} />
          <PermissionMeta label="Directory" value={parentDir} />
        </div>
      ) : null}
      {permission.permission === "doom_loop" ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <PermissionMeta label="Tool" value={doomTool} />
          </div>
          <PermissionCode
            code={doomInput ? JSON.stringify(doomInput, null, 2) : undefined}
            language="json"
          />
        </div>
      ) : null}
      {showPatterns && permission.patterns.length ? (
        <div className="space-y-1">
          <PermissionMeta label="Patterns" value={permission.patterns.join(", ")} />
        </div>
      ) : null}
      {diff ? <DiffView diff={diff} filePath={filepath} /> : null}
    </div>
  );
}

function getPermissionTitle(permission: OpencodePermissionRequest, messages: OpencodeMessageWithParts[]) {
  const metadata = permission.metadata || {};
  const input = getToolInput(permission, messages) || getObject(metadata.input) || {};

  if (permission.permission === "bash") {
    const command = getText(input.command);

    if (command) {
      return `bash: ${command}`;
    }
  }

  if (permission.permission === "task") {
    const subagent = getText(metadata.subagent_type) || getText(input.subagent_type);
    const description = getText(metadata.description) || getText(input.description);

    if (subagent && description) {
      return `task: ${subagent} - ${description}`;
    }

    if (description) {
      return `task: ${description}`;
    }
  }

  if (permission.permission === "read") {
    const filePath = getText(input.filePath) || permission.patterns[0];

    if (filePath) {
      return `read: ${filePath}`;
    }
  }

  if (permission.permission === "glob") {
    const pattern = getText(metadata.pattern) || getText(input.pattern);

    if (pattern) {
      return `glob: ${pattern}`;
    }
  }

  if (permission.permission === "grep") {
    const pattern = getText(metadata.pattern) || getText(input.pattern);

    if (pattern) {
      return `grep: ${pattern}`;
    }
  }

  if (permission.permission === "list") {
    const path = getText(metadata.path) || getText(input.path) || permission.patterns[0];

    if (path) {
      return `list: ${path}`;
    }
  }

  if (permission.permission === "webfetch") {
    const url = getText(metadata.url) || getText(input.url);

    if (url) {
      return `webfetch: ${url}`;
    }
  }

  if (permission.permission === "websearch") {
    const query = getText(metadata.query) || getText(input.query);

    if (query) {
      return `websearch: ${query}`;
    }
  }

  if (permission.permission === "codesearch") {
    const query = getText(metadata.query) || getText(input.query);

    if (query) {
      return `codesearch: ${query}`;
    }
  }

  if (permission.permission === "external_directory") {
    const filepath = getText(metadata.filepath);

    if (filepath) {
      return `external_directory: ${filepath}`;
    }
  }

  if (permission.permission === "doom_loop") {
    const tool = getText(metadata.tool);

    if (tool) {
      return `doom_loop: ${tool}`;
    }
  }

  const description = getText(metadata.description);

  if (description) {
    return `${permission.permission}: ${description}`;
  }

  return permission.permission;
}

export function PermissionPrompt({ messages, permission, onReply }: PermissionPromptProps) {
  const [expanded, setExpanded] = useState(false);
  const title = useMemo(() => getPermissionTitle(permission, messages), [messages, permission]);

  return (
    <div className="space-y-4 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <button
          aria-label={expanded ? "Collapse permission details" : "Expand permission details"}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <Icon className="size-5" icon={expanded ? "mdi:unfold-less-horizontal" : "mdi:unfold-more-horizontal"} />
        </button>
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <p className="pt-2 text-sm leading-6 font-bold break-words">{title}</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label="Approve permission"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
              onClick={() => onReply(permission.id, "once")}
              type="button"
            >
              <Icon className="size-5" icon="mdi:checkbox-marked" />
            </button>
            <button
              aria-label="Always approve permission"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
              onClick={() => onReply(permission.id, "always")}
              type="button"
            >
              <Icon className="size-5" icon="mdi:checkbox-multiple-marked" />
            </button>
            <button
              aria-label="Deny permission"
              className="inline-flex min-h-11 min-w-11 items-center justify-center"
              onClick={() => onReply(permission.id, "reject")}
              type="button"
            >
              <Icon className="size-5" icon="mdi:close-box" />
            </button>
          </div>
        </div>
      </div>
      {expanded ? <PermissionDetails messages={messages} permission={permission} /> : null}
    </div>
  );
}
