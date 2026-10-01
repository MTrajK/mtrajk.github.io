import { commands, interpolate } from "./commands.js";
import { parseCommand } from "./parse-command.js";

/** @param {string} input @param {import('./types.js').Content} content @returns {import('./types.js').Result} */
export function executeCommand(input, content) {
  const parsed = parseCommand(input);
  if (parsed.error)
    return {
      type: "error",
      message: interpolate(content.terminal.messages[parsed.error], {
        command: parsed.value ?? "",
      }),
    };
  const { command, args } = parsed;
  if (command === "clear") return { type: "clear" };
  if (command === "lang") return { type: "language", locale: args[0] };
  if (command === "help")
    return {
      type: "help",
      title: content.terminal.messages.usage,
      hint: content.terminal.messages.hint,
      items: commands.map((id) => ({
        command: `mtrajk ${id}`,
        description: content.terminal.commandDescriptions[id],
      })),
    };
  if (command === "skills")
    return {
      type: "skills",
      title: content.ui.skills,
      groups: content.sections.find((s) => s.id === "strengths").skills,
    };
  return {
    type: "sections",
    command,
    sections:
      command === "all"
        ? content.sections
        : content.sections.filter((s) => s.id === command),
  };
}
