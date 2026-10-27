import { safeUrl } from "./commands.js";

const markdownLink = /\[([^\]\r\n]+)\]\(([^)\s]+)\)/g;

/** @typedef {{ text: string, url?: string }} InlinePart */

/** @returns {InlinePart[]} */
export function parseInlineLinks(value) {
  const text = String(value);
  const parts = [];
  let offset = 0;
  for (const match of text.matchAll(markdownLink)) {
    if (match.index > offset)
      parts.push({ text: text.slice(offset, match.index) });
    parts.push({ text: match[1], url: match[2] });
    offset = match.index + match[0].length;
  }
  if (offset < text.length || parts.length === 0)
    parts.push({ text: text.slice(offset) });
  return parts;
}

export function isSafeInlineLink(url) {
  if (!safeUrl(url)) return false;
  return new URL(url).protocol === "https:";
}

export function inlinePlainText(value) {
  return parseInlineLinks(value)
    .map(({ text, url }) => (url ? `${text} (${url})` : text))
    .join("");
}
