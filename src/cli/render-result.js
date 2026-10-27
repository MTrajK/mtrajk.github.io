import { cleanText } from "../core/commands.js";
import { inlinePlainText } from "../core/inline-links.js";
import { getShareLinks } from "../core/share.js";

/** @param {import('../core/types.js').Result} result @param {import('../core/types.js').Content} content */
export function renderText(
  result,
  content,
  { width = 80, color = false } = {},
) {
  const lines = [];
  const heading = (value) =>
    lines.push(
      "",
      color
        ? `\x1b[36m${cleanText(inlinePlainText(value))}\x1b[0m`
        : cleanText(inlinePlainText(value)),
    );
  const paragraph = (value) => {
    const limit = Math.max(20, Math.min(120, width));
    const words = cleanText(inlinePlainText(value)).split(/\s+/);
    let line = "";
    for (let word of words) {
      if (line && line.length + word.length + 1 > limit) {
        lines.push(line);
        line = "";
      }
      while (word.length > limit) {
        lines.push(word.slice(0, limit));
        word = word.slice(limit);
      }
      line += `${line ? " " : ""}${word}`;
    }
    if (line) lines.push(line);
  };
  const links = (values) => {
    for (const link of values) paragraph(`${link.label}: ${link.url}`);
  };
  const skills = (groups) => {
    for (const group of groups) {
      heading(group.title);
      paragraph(group.values.join(" · "));
    }
  };
  if (result.type === "error") paragraph(result.message);
  if (result.type === "help") {
    paragraph(result.title);
    paragraph(result.hint);
    for (const item of result.items)
      paragraph(`${item.command} — ${item.description}`);
    paragraph(content.terminal.messages.flags);
  }
  if (result.type === "skills") {
    heading(result.title);
    skills(result.groups);
  }
  if (result.type === "sections") {
    for (const section of result.sections) {
      heading(section.title);
      if (section.id === "intro") {
        paragraph(content.profile.name);
        paragraph(content.profile.headline);
        paragraph(content.profile.motto);
      }
      for (const value of section.paragraphs) paragraph(value);
      for (const item of section.items) {
        heading(item.title);
        paragraph(item.subtitle);
        if (item.organization)
          paragraph(`${item.organization} / ${item.client ?? ""}`);
        for (const value of item.paragraphs) paragraph(value);
        for (const value of item.bullets) paragraph(`- ${value}`);
        if (item.tags.length) paragraph(item.tags.join(" · "));
        links(item.links);
      }
      if (section.skills) skills(section.skills);
      links(section.links);
      if (section.id === "contact") {
        heading(content.ui.sharePage);
        links(getShareLinks(content));
      }
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

export function renderBanner(content, width = 80) {
  const wordmark = content.artwork.wordmark.every(
    (line) => line.length <= width,
  )
    ? content.artwork.wordmark
    : content.artwork.compact;
  return `${wordmark.map(cleanText).join("\n")}\n`;
}
