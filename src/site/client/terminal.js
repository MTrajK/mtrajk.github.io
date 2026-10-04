import validate from "../../../.generated/validate.js";
import { fetchContent } from "../../core/content.js";
import { executeCommand } from "../../core/execute-command.js";
import { getCompletions, interpolate, MAX_INPUT } from "../../core/commands.js";
import { element, renderResult } from "./render-result.js";
import { createReveal, revealUnits } from "../../core/reveal.js";

export async function createTerminal(config, onCv) {
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
    const style = getComputedStyle(output);
    if (output instanceof HTMLElement)
      output.style.setProperty(
        "--output-space",
        `${Math.max(0, output.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom))}px`,
      );
  }
  function focusPrompt() {
    if (!active() || input.disabled) return;
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
  const installation = element("div", "", "terminal-install");
  installation.id = "terminal-install";
  installation.hidden = true;
  output.prepend(installation);
  const history = [];
  let cursor = 0;
  let draft = "";
  let started = false;
  let startupTimer = 0;
  let startupVersion = 0;
  let dismissed = false;
  let cycle = [];
  let cycleIndex = -1;
  let suggestion = "";
  let answer;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", () => {
    if (motion.matches) answer?.reveal.finish();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) answer?.reveal.finish();
  });
  const atEnd = () =>
    input.selectionStart === input.value.length &&
    input.selectionEnd === input.value.length;
  function refreshSuggestion() {
    suggestion =
      !input.disabled && !dismissed && atEnd() && document.activeElement === input
        ? (getCompletions(input.value, ["cv"])[0] ?? "")
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
  function cancelAnswer() {
    if (!answer) return;
    answer.reveal.cancel();
    answer.response.removeAttribute("aria-busy");
    answer.response.style.removeProperty("min-height");
    answer.skip.remove();
    answer = undefined;
  }
  function revealAnswer(response, command) {
    const parts = [];
    const walker = document.createTreeWalker(response, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      parts.push({ node, units: revealUnits(node.textContent) });
    }
    const length = parts.reduce((total, part) => total + part.units.length, 0);
    response.style.minHeight = `${response.getBoundingClientRect().height}px`;
    response.setAttribute("aria-busy", "true");
    const links = [...response.querySelectorAll("a")];
    for (const link of links) link.hidden = true;
    for (const part of parts) part.node.textContent = "";
    const skip = element("button", content.ui.showAnswer, "terminal-skip");
    skip.setAttribute("type", "button");
    skip.addEventListener("click", () => {
      answer?.reveal.finish();
      focusPrompt();
    });
    response.before(skip);
    status.textContent = interpolate(content.ui.revealing, { command });
    answer = {
      response,
      skip,
      reveal: createReveal(length, position => {
        for (const part of parts) {
          const count = Math.min(position, part.units.length);
          part.node.textContent = part.units.slice(0, count).join("");
          position -= count;
        }
      }, () => {
        const focused = document.activeElement === skip;
        response.removeAttribute("aria-busy");
        response.style.removeProperty("min-height");
        for (const link of links) link.hidden = false;
        skip.remove();
        answer = undefined;
        status.textContent = interpolate(content.ui.resultReady, { command });
        if (focused) focusPrompt();
      }),
    };
  }
  function leave() {
    cancelAnswer();
    clearTimeout(startupTimer);
    startupVersion++;
    input.disabled = false;
    terminalView.removeAttribute("aria-busy");
  }
  function enter() {
    leave();
    const version = startupVersion;
    started = true;
    input.value = "";
    input.disabled = true;
    history.length = 0;
    cursor = 0;
    draft = "";
    resetCompletion();
    refreshSuggestion();
    transcript.replaceChildren();
    welcome.setAttribute("hidden", "");
    installation.hidden = false;
    terminalView.setAttribute("aria-busy", "true");
    status.textContent = content.ui.installDemo;
    const meter = element("pre", "", "install-meter");
    meter.setAttribute("role", "progressbar");
    meter.setAttribute("aria-label", content.ui.installProgress);
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "100");
    const label = element("p", content.ui.installProgress, "install-label");
    installation.replaceChildren(
      element("p", `${content.ui.commandPrompt} npm install mtrajk`, "command-echo"),
      element("p", content.ui.installDemo),
      label,
      meter,
    );
    let percent = 0;
    const update = () => {
      meter.setAttribute("aria-valuenow", String(percent));
      meter.textContent = `[${"#".repeat(percent / 5)}${"-".repeat(20 - percent / 5)}] ${percent}%`;
    };
    const finish = () => {
      if (version !== startupVersion || !active()) return;
      label.textContent = content.ui.installReady;
      input.disabled = false;
      terminalView.removeAttribute("aria-busy");
      welcome.removeAttribute("hidden");
      run("mtrajk intro", { remember: false });
      output.scrollTop = 0;
      status.textContent = content.ui.installReady;
      focusPrompt();
    };
    const tick = () => {
      if (version !== startupVersion || !active()) return;
      percent += 5;
      update();
      startupTimer = window.setTimeout(percent === 100 ? finish : tick, percent === 100 ? 120 : 60);
    };
    syncViewport();
    output.scrollTop = 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      percent = 100;
      update();
      finish();
    } else {
      update();
      startupTimer = window.setTimeout(tick, 60);
    }
  }
  function run(command, { remember = true } = {}) {
    if (!active() || input.disabled) return;
    if (command.length <= MAX_INPUT && /^[ \t]*(?:mtrajk[ \t]+)?cv[ \t]*$/i.test(command)) {
      input.value = "";
      onCv();
      return;
    }
    const result = executeCommand(command, content);
    if (result.type === "clear" || result.type === "language") cancelAnswer();
    else answer?.reveal.finish();
    if (result.type === "help")
      result.items = [...result.items, { command: "cv", description: content.ui.webCv }];
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
      location.assign(next.href);
      return;
    }
    if (result.type === "clear") {
      transcript.replaceChildren();
      welcome.setAttribute("hidden", "");
      installation.hidden = true;
      output.scrollTop = 0;
      status.textContent = content.ui.cleared;
    } else {
      const entry = element("article", "", "terminal-entry");
      const response = renderResult(result, content);
      response.className = "terminal-response";
      entry.append(
        element("p", `${content.ui.commandPrompt} ${command}`, "command-echo"),
        response,
      );
      transcript.append(entry);
      while (transcript.children.length > 50)
        transcript.firstElementChild.remove();
      if (result.type === "sections" && result.command !== "all" && !motion.matches)
        revealAnswer(response, command);
      else status.textContent = interpolate(content.ui.resultReady, { command });
      syncViewport();
      output.scrollTop += entry.getBoundingClientRect().top - output.getBoundingClientRect().top - parseFloat(getComputedStyle(output).paddingTop);
    }
    input.value = "";
    resetCompletion();
    refreshSuggestion();
    if (remember) focusPrompt();
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (answer && !input.value.trim()) answer.reveal.finish();
    else run(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
      return;
    if (event.key === "Escape") {
      answer?.reveal.finish();
      dismissed = true;
      cycle = [];
      cycleIndex = -1;
      refreshSuggestion();
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && !dismissed && atEnd()) {
      if (!cycle.length) cycle = getCompletions(input.value, ["cv"]);
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
    enter,
    leave,
    focus: focusPrompt,
    get started() {
      return started;
    },
  };
}
