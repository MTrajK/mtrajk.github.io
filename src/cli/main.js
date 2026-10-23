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
import { createReveal, revealUnits } from "../core/reveal.js";

export function parseArgs(args) {
  const options = {
    locale: "en",
    offline: false,
    json: false,
    noColor: false,
    noAnimation: false,
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
    else if (arg === "--no-animation") options.noAnimation = true;
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
    const animate = !options.noAnimation && !env.CI && env.TERM !== "dumb";
    output.write(renderBanner(content, settings.width));
    output.write(`${content.terminal.messages.hint}\n`);
    if (animate) output.write(`${content.terminal.messages.revealHint}\n`);
    const rl = createInterface({
      input,
      output,
      terminal: true,
      historySize: 100,
      completer: (line) => [getCompletions(line), line],
    });
    const lines = rl[Symbol.asyncIterator]();
    let reveal;
    let resolveReveal;
    let closed = false;
    let promptShown = false;
    const prompt = () => {
      if (closed) return;
      rl.setPrompt(`${content.ui.commandPrompt} `);
      rl.prompt();
    };
    const showPrompt = () => {
      if (promptShown) promptShown = false;
      else prompt();
    };
    const displayInteractive = async (result) => {
      if (!animate || result.type !== "sections" || result.command === "all") {
        display(result);
        return;
      }
      const units = revealUnits(renderText(result, content, settings));
      let position = 0;
      await new Promise(resolve => {
        resolveReveal = resolve;
        reveal = createReveal(units.length, end => {
          const chunk = units.slice(position, end).join("");
          position = end;
          output.write(chunk);
        }, () => {
          reveal = undefined;
          resolveReveal = undefined;
          resolve(undefined);
        });
      });
    };
    const cancelReveal = () => {
      if (!reveal) return false;
      reveal.cancel();
      reveal = undefined;
      output.write(`${settings.color ? "\x1b[0m" : ""}\n`);
      const resolve = resolveReveal;
      resolveReveal = undefined;
      resolve(undefined);
      return true;
    };
    const skipReveal = (_text, key) => {
      if (!reveal || (key?.ctrl && ["c", "d"].includes(key.name))) return;
      reveal.finish();
      promptShown = true;
      prompt();
    };
    input.prependListener("keypress", skipReveal);
    rl.on("close", () => {
      closed = true;
      cancelReveal();
    });
    rl.on("SIGINT", () => {
      if (cancelReveal()) output.write(`${content.terminal.messages.cancelled}\n`);
      else if (rl.line) {
        rl.write(null, { ctrl: true, name: "e" });
        rl.write(null, { ctrl: true, name: "u" });
        output.write(`\n${content.terminal.messages.cancelled}\n`);
        prompt();
      } else rl.close();
    });
    try {
      await displayInteractive(executeCommand("intro", content));
      showPrompt();
      for await (const line of lines) {
        const next = executeCommand(line, content);
        if (next.type === "clear") output.write("\x1b[2J\x1b[H");
        else if (next.type === "language") {
          locale = next.locale;
          content = await load(locale);
          output.write(
            `${interpolate(content.terminal.messages.languageChanged, { locale })}\n`,
          );
        } else await displayInteractive(next);
        showPrompt();
      }
    } finally {
      input.removeListener("keypress", skipReveal);
      cancelReveal();
      rl.close();
    }
    output.write(`\n${content.terminal.messages.goodbye}\n`);
    return 0;
  } catch {
    diagnostic(snapshots[locale].terminal.messages.fatal);
    return 1;
  }
}
