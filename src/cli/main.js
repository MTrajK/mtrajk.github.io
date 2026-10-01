import { createInterface } from "node:readline";
import {
  getCompletions,
  interpolate,
  locales,
  MAX_INPUT,
} from "../core/commands.js";
import { executeCommand } from "../core/execute-command.js";
import { renderBanner, renderText } from "./render-result.js";
import { createContentLoader } from "./load-content.js";

export function parseArgs(args) {
  const options = {
    locale: "en",
    offline: false,
    json: false,
    noColor: false,
    help: false,
    version: false,
    command: [],
    error: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--lang") {
      const locale = args[++i];
      if (!locales.includes(locale)) options.error = true;
      else options.locale = locale;
    } else if (arg === "--offline") options.offline = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--no-color") options.noColor = true;
    else if (arg === "--help") options.help = true;
    else if (arg === "--version") options.version = true;
    else if (arg.startsWith("-") || /\s/.test(arg)) options.error = true;
    else options.command.push(arg);
  }
  if (args.join(" ").length > MAX_INPUT) options.error = true;
  return options;
}

export async function runCli(
  args,
  {
    snapshots,
    version,
    input = process.stdin,
    output = process.stdout,
    error = process.stderr,
    env = process.env,
    fetcher = globalThis.fetch,
    timeout = 2000,
  },
) {
  const options = parseArgs(args);
  let locale = options.locale;
  let content = snapshots[locale];
  const diagnostic = (message) => error.write(`${message}\n`);
  const load = createContentLoader(snapshots, {
    offline: options.offline,
    fetcher,
    timeout,
    notice: diagnostic,
  });
  const tty = Boolean(input.isTTY && output.isTTY);
  const settings = {
    width: output.columns || 80,
    color:
      tty &&
      !options.noColor &&
      !Object.hasOwn(env, "NO_COLOR") &&
      env.TERM !== "dumb",
  };
  const display = (result) =>
    output.write(
      options.json
        ? `${JSON.stringify(result)}\n`
        : renderText(result, content, settings),
    );
  try {
    if (options.error) {
      diagnostic(content.terminal.messages.invalid);
      return 2;
    }
    if (options.version) {
      output.write(
        options.json
          ? `${JSON.stringify({ version })}\n`
          : `${interpolate(content.terminal.messages.version, { version })}\n`,
      );
      return 0;
    }
    if (options.help || options.command.join(" ") === "help") {
      display(executeCommand("help", content));
      return 0;
    }
    const interactive = tty && !options.command.length && !options.json;
    const command =
      options.command.join(" ") || (options.json ? "all" : "intro");
    let result = executeCommand(command, content);
    if (result.type === "error") {
      display(result);
      return 2;
    }
    if (result.type === "clear") {
      diagnostic(content.terminal.messages.clearOnly);
      return 2;
    }
    if (result.type === "language") locale = result.locale;
    content = await load(locale);
    if (content.preview) diagnostic(content.terminal.messages.preview);
    if (!interactive) {
      if (result.type === "language") result = executeCommand("intro", content);
      else result = executeCommand(command, content);
      if (tty && !options.json && command === "intro")
        output.write(renderBanner(content, settings.width));
      display(result);
      if (!options.command.length && !options.json)
        display(executeCommand("help", content));
      return 0;
    }
    output.write(renderBanner(content, settings.width));
    display(executeCommand("intro", content));
    output.write(`${content.terminal.messages.hint}\n`);
    const rl = createInterface({
      input,
      output,
      terminal: true,
      historySize: 100,
      completer: (line) => [getCompletions(line), line],
    });
    const prompt = () => {
      rl.setPrompt(`${content.ui.commandPrompt} `);
      rl.prompt();
    };
    rl.on("SIGINT", () => {
      if (rl.line) {
        rl.write(null, { ctrl: true, name: "e" });
        rl.write(null, { ctrl: true, name: "u" });
        output.write(`\n${content.terminal.messages.cancelled}\n`);
        prompt();
      } else rl.close();
    });
    prompt();
    for await (const line of rl) {
      const next = executeCommand(line, content);
      if (next.type === "clear") output.write("\x1b[2J\x1b[H");
      else if (next.type === "language") {
        locale = next.locale;
        content = await load(locale);
        output.write(
          `${interpolate(content.terminal.messages.languageChanged, { locale })}\n`,
        );
      } else display(next);
      prompt();
    }
    output.write(`\n${content.terminal.messages.goodbye}\n`);
    return 0;
  } catch {
    diagnostic(snapshots[locale].terminal.messages.fatal);
    return 1;
  }
}
