import validate from "../../../.generated/validate.js";
import { fetchContent } from "../../core/content.js";
import { executeCommand } from "../../core/execute-command.js";
import {
  getCompletions,
  interpolate,
  sectionForCommand,
} from "../../core/commands.js";
import { parseCommand } from "../../core/parse-command.js";
import { element, renderResult } from "./render-result.js";

export async function createTerminal(config, onSection) {
  let content;
  const options = {
    locale: config.locale,
    version: config.contentVersion,
    validate,
  };
  try {
    content = await fetchContent(
      new URL(config.dataUrl, location.origin).href,
      options,
    );
  } catch {
    content = await fetchContent(
      new URL(`/data/v1/${config.locale}.json`, location.origin).href,
      options,
    );
  }
  const welcome = document.querySelector("#terminal-welcome");
  const wide = element(
    "pre",
    content.artwork.wordmark.join("\n"),
    "terminal-wordmark wide",
  );
  const compact = element(
    "pre",
    content.artwork.compact.join("\n"),
    "terminal-wordmark compact",
  );
  wide.setAttribute("aria-hidden", "true");
  compact.setAttribute("aria-hidden", "true");
  welcome.replaceChildren(
    wide,
    compact,
    element("h2", content.profile.name),
    element("p", content.profile.headline),
  );
  document.querySelector("#terminal-hint").textContent =
    `${content.terminal.messages.hint} ${content.ui.terminalSubtitle}`;
  const form = document.querySelector("#terminal-form");
  const candidate = document.querySelector("#command-input");
  if (!(candidate instanceof HTMLInputElement))
    throw new Error("Missing command input");
  const input = candidate;
  const transcript = document.querySelector("#transcript");
  const output = document.querySelector("#terminal-output");
  const terminalView = document.querySelector("#dev-view");
  const active = () => document.documentElement.dataset.mode === "dev";
  function syncViewport() {
    if (!active()) return;
    const viewport = window.visualViewport;
    const unscaled = viewport && viewport.scale === 1;
    document.documentElement.style.setProperty(
      "--terminal-height",
      `${unscaled ? viewport.height : window.innerHeight}px`,
    );
    document.documentElement.style.setProperty(
      "--terminal-top",
      `${unscaled ? viewport.offsetTop : 0}px`,
    );
  }
  function focusPrompt() {
    if (!active()) return;
    syncViewport();
    input.focus({ preventScroll: true });
  }
  function restoreFocus() {
    if (
      document.activeElement === document.body ||
      document.activeElement === input
    )
      focusPrompt();
  }
  terminalView.addEventListener("click", (event) => {
    if (
      !(event.target instanceof Element) ||
      event.target.closest(
        "a, button, input, textarea, select, summary, [contenteditable]",
      ) ||
      window.getSelection()?.toString()
    )
      return;
    focusPrompt();
  });
  window.addEventListener("focus", restoreFocus);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) restoreFocus();
  });
  window.addEventListener("resize", syncViewport);
  window.visualViewport?.addEventListener("resize", syncViewport);
  window.visualViewport?.addEventListener("scroll", syncViewport);
  const status = document.querySelector("#terminal-status");
  const ghost = document.querySelector("#command-ghost");
  const ghostPrefix = document.querySelector("#ghost-prefix");
  const ghostSuffix = document.querySelector("#ghost-suffix");
  const completionStatus = document.querySelector("#completion-status");
  const history = [];
  let cursor = 0;
  let draft = "";
  let lastSection = "intro";
  let started = false;
  let dismissed = false;
  let cycle = [];
  let cycleIndex = -1;
  let suggestion = "";
  const atEnd = () =>
    input.selectionStart === input.value.length &&
    input.selectionEnd === input.value.length;
  function refreshSuggestion() {
    suggestion =
      !dismissed && atEnd() && document.activeElement === input
        ? (getCompletions(input.value)[0] ?? "")
        : "";
    ghostPrefix.textContent = suggestion ? input.value : "";
    ghostSuffix.textContent = suggestion.slice(input.value.length);
    ghost.scrollLeft = input.scrollLeft;
    completionStatus.textContent = suggestion
      ? `${content.ui.suggestions}: ${suggestion}`
      : "";
  }
  function resetCompletion() {
    dismissed = false;
    cycle = [];
    cycleIndex = -1;
  }
  function accept(value) {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    refreshSuggestion();
  }
  function run(command, { remember = true, navigate = true } = {}) {
    started = true;
    const result = executeCommand(command, content);
    if (remember && command.trim()) {
      history.push(command);
      if (history.length > 100) history.shift();
    }
    cursor = history.length;
    draft = "";
    if (result.type === "language") {
      const next = new URL(
        result.locale === "en" ? "/" : "/mk/",
        location.origin,
      );
      next.searchParams.set("mode", "dev");
      next.hash = lastSection;
      location.assign(next.href);
      return;
    }
    if (result.type === "clear") {
      transcript.replaceChildren();
      welcome.setAttribute("hidden", "");
      status.textContent = content.ui.cleared;
    } else {
      const entry = element("article", "", "terminal-entry");
      entry.append(
        element("p", `${content.ui.commandPrompt} ${command}`, "command-echo"),
        renderResult(result, content),
      );
      transcript.append(entry);
      while (transcript.children.length > 50)
        transcript.firstElementChild.remove();
      status.textContent = interpolate(content.ui.resultReady, { command });
      const section = sectionForCommand(parseCommand(command).command);
      if (config.sectionIds.includes(section)) {
        lastSection = section;
        if (navigate) onSection(section);
      }
    }
    input.value = "";
    resetCompletion();
    refreshSuggestion();
    output.scrollTop = output.scrollHeight;
    if (remember) focusPrompt();
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
      return;
    if (event.key === "Escape") {
      dismissed = true;
      cycle = [];
      cycleIndex = -1;
      refreshSuggestion();
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && !dismissed && atEnd()) {
      if (!cycle.length) cycle = getCompletions(input.value);
      if (!cycle.length) return;
      event.preventDefault();
      cycleIndex = (cycleIndex + 1) % cycle.length;
      accept(cycle[cycleIndex]);
      completionStatus.textContent = `${content.ui.suggestions}: ${input.value}`;
      return;
    }
    if (
      event.key === "ArrowRight" &&
      !event.shiftKey &&
      atEnd() &&
      suggestion
    ) {
      event.preventDefault();
      const value = suggestion;
      resetCompletion();
      accept(value);
      return;
    }
    if (
      ["ArrowUp", "ArrowDown"].includes(event.key) &&
      !event.shiftKey &&
      history.length
    ) {
      event.preventDefault();
      if (cursor === history.length) draft = input.value;
      cursor = Math.max(
        0,
        Math.min(history.length, cursor + (event.key === "ArrowUp" ? -1 : 1)),
      );
      resetCompletion();
      accept(cursor === history.length ? draft : history[cursor]);
    }
  });
  input.addEventListener("input", () => {
    resetCompletion();
    refreshSuggestion();
  });
  input.addEventListener("compositionstart", () => {
    dismissed = true;
    refreshSuggestion();
  });
  input.addEventListener("compositionend", () => {
    resetCompletion();
    refreshSuggestion();
  });
  input.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      cycle = [];
      cycleIndex = -1;
      refreshSuggestion();
    }
  });
  input.addEventListener("click", () => {
    cycle = [];
    cycleIndex = -1;
    refreshSuggestion();
  });
  input.addEventListener("focus", refreshSuggestion);
  input.addEventListener("blur", refreshSuggestion);
  input.addEventListener("scroll", () => {
    ghost.scrollLeft = input.scrollLeft;
  });
  return {
    run,
    focus: focusPrompt,
    get section() {
      return lastSection;
    },
    get started() {
      return started;
    },
  };
}
