export const APP_NAME = "scriptorium";

function isNonEmptyTitlePart(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

export function getDocumentTitle(...parts: Array<string | null | undefined>) {
  const labels = parts.map((part) => part?.trim()).filter(isNonEmptyTitlePart);

  return labels.length ? [...labels, APP_NAME].join(" | ") : APP_NAME;
}
