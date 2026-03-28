import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

export type AssistantFileReferenceSource = "text" | "inlineCode";

export type ParsedAssistantFileReference = {
  displayText: string;
  endLine: number | null;
  lookupPath: string;
  startLine: number | null;
};

export type AssistantFileReferenceResolution = {
  path: string;
};

type MarkdownNode = {
  children?: MarkdownNode[];
  type: string;
  url?: string;
  value?: string;
};

type LinkableNode = {
  type: "link";
  url: string;
  children: MarkdownNode[];
};

const TEXT_REFERENCE_PATTERN = /@?(?:\.\/)?(?:[A-Za-z0-9_$+.-]+\/)*[A-Za-z0-9_$+.-]+\.[A-Za-z0-9_$+.-]+(?:#L\d+(?:C\d+)?|:\d+-\d+|:\d+(?::\d+)?)?/g;
const COLUMN_REFERENCE_PATTERN = /^(.*):(\d+):(\d+)$/;
const HASH_LINE_REFERENCE_PATTERN = /^(.*)#L(\d+)(?:C\d+)?$/i;
const RANGE_REFERENCE_PATTERN = /^(.*):(\d+)-(\d+)$/;
const SINGLE_LINE_REFERENCE_PATTERN = /^(.*):(\d+)$/;
const VALID_REFERENCE_PATH_PATTERN = /^[A-Za-z0-9_$+./ -]+$/;

export function buildAssistantFileReferenceHref(
  filesPath: string,
  reference: ParsedAssistantFileReference,
  resolvedPath: string,
) {
  const searchParams = new URLSearchParams({
    file: resolvedPath,
    path: getWorkspaceParentPath(resolvedPath),
  });

  if (reference.startLine !== null) {
    searchParams.set("line", String(reference.startLine));
  }

  if (reference.endLine !== null && reference.endLine !== reference.startLine) {
    searchParams.set("endLine", String(reference.endLine));
  }

  return `${filesPath}?${searchParams.toString()}`;
}

export function collectAssistantFileReferenceCandidates(markdownText: string) {
  const tree = parseMarkdownTree(markdownText);
  const candidates = new Set<string>();

  visitMarkdownTree(tree, (node, parents) => {
    if (node.type === "inlineCode") {
      const reference = parseAssistantFileReference(node.value || "", "inlineCode");

      if (reference) {
        candidates.add(reference.lookupPath);
      }

      return;
    }

    if (node.type !== "text" || parents.some((parent) => parent.type === "link" || parent.type === "linkReference")) {
      return;
    }

    for (const match of extractTextFileReferenceMatches(node.value || "")) {
      candidates.add(match.reference.lookupPath);
    }
  });

  return Array.from(candidates);
}

export function parseAssistantFileReference(
  value: string,
  source: AssistantFileReferenceSource,
): ParsedAssistantFileReference | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const { pathValue, startLine, endLine } = splitReferenceLines(trimmedValue);
  const lookupPath = normalizeAssistantFileReferencePath(pathValue, source);

  if (!lookupPath) {
    return null;
  }

  return {
    displayText: value,
    endLine,
    lookupPath,
    startLine,
  };
}

export function remarkAssistantFileReferenceLinks(options: {
  filesPath?: string;
  resolutions: ReadonlyMap<string, AssistantFileReferenceResolution | null>;
}) {
  return () => (tree: MarkdownNode) => {
    if (!options.filesPath) {
      return;
    }

    transformMarkdownTree(tree, options.filesPath, options.resolutions);
  };
}

export function normalizeAssistantFileReferencePath(
  value: string,
  source: AssistantFileReferenceSource,
): string | null {
  let normalized = value.trim();

  if (normalized.startsWith("@")) {
    normalized = normalized.slice(1).trimStart();
  }

  if (!normalized) {
    return null;
  }

  normalized = normalized.replace(/\\+/g, "/");

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  if (
    !normalized
    || normalized.startsWith("/")
    || normalized.startsWith("~/")
    || normalized.startsWith("file://")
    || normalized.includes("://")
    || /^[A-Za-z]:\//.test(normalized)
    || normalized.endsWith("/")
  ) {
    return null;
  }

  if (source === "text" && /\s/.test(normalized)) {
    return null;
  }

  if (!VALID_REFERENCE_PATH_PATTERN.test(normalized)) {
    return null;
  }

  const segments = normalized.split("/");

  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return null;
  }

  const basename = segments.at(-1) || "";

  if (!basename.includes(".") || (!normalized.includes("/") && !normalized.includes("."))) {
    return null;
  }

  return normalized;
}

function extractTextFileReferenceMatches(value: string) {
  const matches: Array<{
    end: number;
    reference: ParsedAssistantFileReference;
    start: number;
  }> = [];

  for (const match of value.matchAll(TEXT_REFERENCE_PATTERN)) {
    const matchText = match[0];
    const matchIndex = match.index;

    if (!matchText || matchIndex === undefined) {
      continue;
    }

    const reference = parseAssistantFileReference(matchText, "text");

    if (!reference) {
      continue;
    }

    matches.push({
      end: matchIndex + matchText.length,
      reference,
      start: matchIndex,
    });
  }

  return matches;
}

function getWorkspaceParentPath(path: string) {
  const segments = path.split("/");
  segments.pop();

  return segments.length > 0 ? segments.join("/") : ".";
}

function parseMarkdownTree(markdownText: string) {
  return unified().use(remarkParse).use(remarkGfm).parse(markdownText) as MarkdownNode;
}

function splitReferenceLines(value: string) {
  let match = HASH_LINE_REFERENCE_PATTERN.exec(value);

  if (match) {
    const line = Number.parseInt(match[2] || "", 10);

    if (line > 0) {
      return {
        endLine: line,
        pathValue: match[1] || value,
        startLine: line,
      };
    }

    return {
      endLine: null,
      pathValue: value,
      startLine: null,
    };
  }

  match = RANGE_REFERENCE_PATTERN.exec(value);

  if (match) {
    const startLine = Number.parseInt(match[2] || "", 10);
    const endLine = Number.parseInt(match[3] || "", 10);

    if (startLine > 0 && endLine > 0) {
      return {
        endLine,
        pathValue: match[1] || value,
        startLine,
      };
    }
  }

  match = COLUMN_REFERENCE_PATTERN.exec(value);

  if (match) {
    const startLine = Number.parseInt(match[2] || "", 10);

    if (startLine > 0) {
      return {
        endLine: startLine,
        pathValue: match[1] || value,
        startLine,
      };
    }
  }

  match = SINGLE_LINE_REFERENCE_PATTERN.exec(value);

  if (match) {
    const startLine = Number.parseInt(match[2] || "", 10);

    if (startLine > 0) {
      return {
        endLine: startLine,
        pathValue: match[1] || value,
        startLine,
      };
    }
  }

  return {
    endLine: null,
    pathValue: value,
    startLine: null,
  };
}

function transformInlineCodeNode(
  node: MarkdownNode,
  filesPath: string,
  resolutions: ReadonlyMap<string, AssistantFileReferenceResolution | null>,
) {
  const reference = parseAssistantFileReference(node.value || "", "inlineCode");

  if (!reference) {
    return node;
  }

  const resolution = resolutions.get(reference.lookupPath);

  if (!resolution) {
    return node;
  }

  const linkNode: LinkableNode = {
    children: [node],
    type: "link",
    url: buildAssistantFileReferenceHref(filesPath, reference, resolution.path),
  };

  return linkNode;
}

function transformMarkdownTree(
  node: MarkdownNode,
  filesPath: string,
  resolutions: ReadonlyMap<string, AssistantFileReferenceResolution | null>,
  parentTypes: string[] = [],
) {
  if (!node.children?.length || shouldSkipNodeChildren(node.type)) {
    return;
  }

  node.children = node.children.flatMap((child) => {
    if (child.type === "inlineCode") {
      return transformInlineCodeNode(child, filesPath, resolutions);
    }

    if (child.type === "text" && !parentTypes.some((parentType) => parentType === "link" || parentType === "linkReference")) {
      return transformTextNode(child, filesPath, resolutions);
    }

    transformMarkdownTree(child, filesPath, resolutions, [...parentTypes, node.type]);
    return child;
  });
}

function transformTextNode(
  node: MarkdownNode,
  filesPath: string,
  resolutions: ReadonlyMap<string, AssistantFileReferenceResolution | null>,
) {
  const value = node.value || "";
  const matches = extractTextFileReferenceMatches(value);

  if (matches.length === 0) {
    return node;
  }

  const nextChildren: MarkdownNode[] = [];
  let cursor = 0;

  for (const match of matches) {
    const resolution = resolutions.get(match.reference.lookupPath);

    if (!resolution) {
      continue;
    }

    if (match.start > cursor) {
      nextChildren.push({
        type: "text",
        value: value.slice(cursor, match.start),
      });
    }

    nextChildren.push({
      children: [{
        type: "text",
        value: value.slice(match.start, match.end),
      }],
      type: "link",
      url: buildAssistantFileReferenceHref(filesPath, match.reference, resolution.path),
    });
    cursor = match.end;
  }

  if (nextChildren.length === 0) {
    return node;
  }

  if (cursor < value.length) {
    nextChildren.push({
      type: "text",
      value: value.slice(cursor),
    });
  }

  return nextChildren;
}

function shouldSkipNodeChildren(nodeType: string) {
  return nodeType === "code" || nodeType === "html" || nodeType === "link" || nodeType === "linkReference";
}

function visitMarkdownTree(
  node: MarkdownNode,
  visitor: (node: MarkdownNode, parents: MarkdownNode[]) => void,
  parents: MarkdownNode[] = [],
) {
  visitor(node, parents);

  if (!node.children?.length || shouldSkipNodeChildren(node.type)) {
    return;
  }

  for (const child of node.children) {
    visitMarkdownTree(child, visitor, [...parents, node]);
  }
}
