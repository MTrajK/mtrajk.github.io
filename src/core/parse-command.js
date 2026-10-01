import { aliases, commands, locales, MAX_INPUT } from "./commands.js";

export function parseCommand(input) {
  if (
    typeof input !== "string" ||
    input.length > MAX_INPUT ||
    /[^a-zA-Z0-9\- \t]/.test(input)
  )
    return { error: "invalid" };
  const tokens = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens[0] === "mtrajk") tokens.shift();
  if (!tokens.length) return { command: "help", args: [] };
  const command = aliases.get(tokens[0]) ?? tokens[0];
  const args = tokens.slice(1);
  if (!commands.includes(command))
    return { error: "unknown", value: tokens[0] };
  if (command === "lang")
    return args.length === 1 && locales.includes(args[0])
      ? { command, args }
      : { error: "language" };
  return args.length ? { error: "invalid" } : { command, args };
}
