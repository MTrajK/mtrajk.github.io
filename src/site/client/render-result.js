export function element(tag, text = "", className = "") {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function renderInstruction(parent, text) {
  parent.replaceChildren(...text.split(/(mtrajk (?:help|cv)\b)/).map((part, index) =>
    index % 2 ? element("code", part, "terminal-command") : document.createTextNode(part),
  ));
}
function appendLinks(parent, links) {
  if (!links.length) return;
  const group = element("div", "", "terminal-links");
  for (const link of links) {
    const anchor = element("a", link.label);
    anchor.href = link.url;
    anchor.rel = "noreferrer";
    group.append(anchor);
  }
  parent.append(group);
}
function appendSkills(parent, groups) {
  for (const group of groups) {
    parent.append(
      element("h3", group.title),
      element("p", group.values.join(" · "), "terminal-skills"),
    );
  }
}
/** @param {import('../../core/types.js').Result} result @param {import('../../core/types.js').Content} content */
export function renderResult(result, content) {
  const output = element("div");
  if (result.type === "error") {
    output.append(element("p", result.message, "terminal-error"));
    return output;
  }
  if (result.type === "help") {
    output.append(element("h2", result.title), element("p", result.hint));
    const list = element("dl", "", "help-list");
    for (const item of result.items)
      list.append(element("dt", item.command), element("dd", item.description));
    output.append(list);
  }
  if (result.type === "skills") {
    output.append(element("h2", result.title));
    appendSkills(output, result.groups);
  }
  if (result.type === "sections") {
    for (const section of result.sections) {
      output.append(element("h2", section.title));
      if (section.id === "intro")
        output.append(
          element("h3", content.profile.name),
          element("p", content.profile.headline),
          element("p", content.profile.motto),
        );
      for (const text of section.paragraphs) output.append(element("p", text));
      for (const item of section.items) {
        output.append(element("h3", item.title), element("p", item.subtitle));
        if (item.organization)
          output.append(
            element(
              "p",
              `${item.organization} / ${item.client ?? ""}`,
              "terminal-skills",
            ),
          );
        for (const text of item.paragraphs) output.append(element("p", text));
        if (item.bullets.length) {
          const list = element("ul");
          for (const text of item.bullets) list.append(element("li", text));
          output.append(list);
        }
        if (item.tags.length)
          output.append(element("p", item.tags.join(" · "), "terminal-skills"));
        appendLinks(output, item.links);
      }
      if (section.skills) appendSkills(output, section.skills);
      appendLinks(output, section.links);
      if (section.id === "contact" && !content.profile.email)
        output.append(element("p", content.ui.emailPending));
    }
  }
  return output;
}
