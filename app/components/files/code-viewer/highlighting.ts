import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-css";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-yaml";

type TokenStream = Array<string | Prism.Token>;

function getPrismGrammar(language: string | null) {
  if (!language || !(language in Prism.languages)) {
    return null;
  }

  return Prism.languages[language];
}

function splitTokenStreamByLine(stream: TokenStream): TokenStream[] {
  const lines: TokenStream[] = [[]];

  function pushLineBreaks(count: number) {
    for (let index = 0; index < count; index += 1) {
      lines.push([]);
    }
  }

  function appendString(value: string) {
    const segments = value.split("\n");

    segments.forEach((segment, index) => {
      if (segment) {
        lines[lines.length - 1]?.push(segment);
      }

      if (index < segments.length - 1) {
        pushLineBreaks(1);
      }
    });
  }

  function appendToken(token: Prism.Token) {
    const content = Array.isArray(token.content) ? token.content : [token.content];
    const splitContent = splitTokenStreamByLine(content);

    splitContent.forEach((lineContent, index) => {
      if (lineContent.length > 0) {
        lines[lines.length - 1]?.push(
          new Prism.Token(
            token.type,
            lineContent.length === 1 ? lineContent[0] ?? "" : lineContent,
            token.alias,
            "",
          ),
        );
      }

      if (index < splitContent.length - 1) {
        pushLineBreaks(1);
      }
    });
  }

  for (const part of stream) {
    if (typeof part === "string") {
      appendString(part);
      continue;
    }

    appendToken(part);
  }

  return lines;
}

export function getPrismLineMarkup(content: string, language: string | null) {
  const grammar = getPrismGrammar(language);

  if (!grammar || !language) {
    return null;
  }

  const tokenStream = Prism.util.encode(Prism.tokenize(content, grammar)) as TokenStream;
  return splitTokenStreamByLine(tokenStream).map((line) => Prism.Token.stringify(line, language));
}
