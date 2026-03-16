import { memo, type ComponentProps } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { PluggableList } from "unified";

import { CodeViewer } from "~/components/files/code-viewer";

import styles from "./message-markdown.module.css";

type MessageMarkdownProps = {
  text: string;
  variant?: "body" | "reasoning";
};

const ALLOWED_TAG_NAMES = new Set([
  ...(defaultSchema.tagNames || []),
  "details",
  "summary",
]).values();

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: Array.from(ALLOWED_TAG_NAMES).filter((tagName) => tagName !== "img"),
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), "target", "rel"],
    code: [...(defaultSchema.attributes?.code || []), ["className", /^language-[\w-]+$/]],
    details: [...(defaultSchema.attributes?.details || []), "open"],
    input: [...(defaultSchema.attributes?.input || []), "checked", "disabled", "type"],
    section: [...(defaultSchema.attributes?.section || []), ["dataFootnotes", true]],
    summary: defaultSchema.attributes?.summary || [],
  },
};

const REMARK_PLUGINS: PluggableList = [remarkGfm];
const REHYPE_PLUGINS: PluggableList = [[rehypeRaw, { tagfilter: true }], [rehypeSanitize, SANITIZE_SCHEMA]];

function isExternalUrl(href: string) {
  return /^https?:\/\//i.test(href);
}

function MarkdownLink({ href, children, node: _node, ...props }: ComponentProps<"a"> & { node?: unknown }) {
  const safeHref = href ? defaultUrlTransform(href) : href;
  const external = safeHref ? isExternalUrl(safeHref) : false;

  return (
      <a
        {...props}
        className={styles.link}
        href={safeHref}
        rel={external ? "noreferrer noopener" : props.rel}
        target={external ? "_blank" : props.target}
    >
      {children}
    </a>
  );
}

function MarkdownCode({ children, className, node: _node, ...props }: ComponentProps<"code"> & { node?: unknown }) {
  const languageMatch = /language-([\w-]+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");

  if (languageMatch) {
    return (
      <CodeViewer
        content={code}
        language={languageMatch[1]}
        showDiffMarkers={false}
        showScrollIndicator={false}
      />
    );
  }

  return <code {...props} className={styles.inlineCode}>{children}</code>;
}

function MarkdownPre({ children }: ComponentProps<"pre">) {
  return <>{children}</>;
}

const MARKDOWN_COMPONENTS = {
  a: MarkdownLink,
  code: MarkdownCode,
  pre: MarkdownPre,
} as const;

export const MessageMarkdown = memo(function MessageMarkdown({ text, variant = "body" }: MessageMarkdownProps) {
  const className = [styles.root, variant === "reasoning" ? styles.reasoning : styles.body].join(" ");

  return (
    <div className={className}>
      <Markdown components={MARKDOWN_COMPONENTS} rehypePlugins={REHYPE_PLUGINS} remarkPlugins={REMARK_PLUGINS}>
        {text}
      </Markdown>
    </div>
  );
});
