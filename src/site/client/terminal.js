import validate from "../../../.generated/validate.js";
import { fetchContent } from "../../core/content.js";
import { executeCommand } from "../../core/execute-command.js";
import { getCompletions, interpolate, MAX_INPUT } from "../../core/commands.js";
import { element, renderInstruction, renderResult } from "./render-result.js";
import { createReveal, revealUnits } from "../../core/reveal.js";

export async function createTerminal(config, onCv, onLanguage = () => {}) {
  const versions = config.contentVersions ?? { [config.locale]: config.contentVersion };
  const cache = new Map();
  function loadLocale(locale) {
    if (cache.has(locale)) return cache.get(locale);
    const pending = (async () => {
      const version = versions[locale];
      if (!version) throw new Error("Missing locale snapshot");
      const options = { locale, version, validate };
      try {
        return await fetchContent(
          new URL(`/data/v1/${locale}.${version}.json`, location.origin).href,
          options,
        );
      } catch {
        return fetchContent(new URL(`/data/v1/${locale}.json`, location.origin).href, options);
      }
    })().catch(error => {
      if (cache.get(locale) === pending) cache.delete(locale);
      throw error;
    });
    cache.set(locale, pending);
    return pending;
  }
  let content = await loadLocale(config.locale);
  let initialLanguageError = false;
  const preferred = new URL(location.href).searchParams.get("terminalLang");
  if (["en", "mk"].includes(preferred) && preferred !== content.locale) {
    try {
      content = await loadLocale(preferred);
    } catch {
      initialLanguageError = true;
    }
  }
  for (const locale of ["en", "mk"])
    if (locale !== content.locale) void loadLocale(locale).catch(() => {});
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
  const form = document.querySelector("#terminal-form");
  const candidate = document.querySelector("#command-input");
  if (!(candidate instanceof HTMLInputElement))
    throw new Error("Missing command input");
  const input = candidate;
  const transcript = document.querySelector("#transcript");
  const output = document.querySelector("#terminal-output");
  const terminalView = document.querySelector("#dev-view");
  const active = () => document.documentElement.dataset.mode === "dev";
  let restorePromptAfterLink = false;
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
    if (!active()) return;
    if (restorePromptAfterLink) {
      restorePromptAfterLink = false;
      focusPrompt();
      return;
    }
    if (
      document.activeElement === document.body ||
      document.activeElement === input
    )
      focusPrompt();
  }
  terminalView.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('a[target="_blank"]')) {
      restorePromptAfterLink = true;
      return;
    }
    if (
      event.target.closest("a, button, input, textarea, select, summary, [contenteditable]") ||
      window.getSelection()?.toString()
    ) return;
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
  let languageVersion = 0;
  let languageChange;
  let commandQueue = Promise.resolve();
  let queuedCommands = 0;
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
  function updateTerminalUi() {
    terminalView.setAttribute("lang", content.locale);
    document.querySelector("#dev-title").textContent = content.ui.terminalTitle;
    document.querySelector("#terminal-input-panel").setAttribute("lang", content.locale);
    form.querySelector("label .sr-only").textContent = content.ui.inputLabel;
    form.querySelector("label [aria-hidden]").textContent = content.ui.commandPrompt;
    output.setAttribute("aria-label", content.ui.transcript);
    renderInstruction(document.querySelector("#terminal-hint"),
      `${content.terminal.messages.hint} ${content.ui.terminalSubtitle}`,
    );
    status.setAttribute("lang", content.locale);
    completionStatus.setAttribute("lang", content.locale);
    refreshSuggestion();
  }
  function applyLocaleUrl(url) {
    if (content.locale === config.locale) url.searchParams.delete("terminalLang");
    else url.searchParams.set("terminalLang", content.locale);
  }
  function appendEntry(response, command) {
    const entry = element("article", "", "terminal-entry");
    entry.setAttribute("lang", content.locale);
    response.className = "terminal-response";
    entry.append(element("p", `${content.ui.commandPrompt} ${command}`, "command-echo"), response);
    transcript.append(entry);
    while (transcript.children.length > 50) transcript.firstElementChild.remove();
    return entry;
  }
  function scrollToEntry(entry) {
    syncViewport();
    output.scrollTop += entry.getBoundingClientRect().top - output.getBoundingClientRect().top - parseFloat(getComputedStyle(output).paddingTop);
  }
  function changeLanguage(locale, command = undefined, persist = true) {
    languageChange?.resume();
    const request = ++languageVersion;
    const generation = startupVersion;
    answer?.reveal.finish();
    status.textContent = interpolate(content.ui.languageLoading, { locale });
    const promise = (async () => {
      try {
        const next = await loadLocale(locale);
        if (request !== languageVersion || generation !== startupVersion || (command && !active())) return false;
        const scroll = output.scrollTop;
        content = next;
        updateTerminalUi();
        if (persist) {
          const url = new URL(location.href);
          applyLocaleUrl(url);
          window.history.replaceState(window.history.state, "", url);
        }
        const message = interpolate(content.terminal.messages.languageChanged, { locale });
        let entry;
        if (command) {
          const response = element("div");
          response.append(element("p", message));
          entry = appendEntry(response, command);
        }
        status.textContent = message;
        if (entry) scrollToEntry(entry);
        else {
          syncViewport();
          output.scrollTop = scroll;
        }
        onLanguage();
        return true;
      } catch {
        if (request !== languageVersion || generation !== startupVersion) return false;
        if (active()) {
          const entry = appendEntry(renderResult({ type: "error", message: content.ui.languageError }, content), command ?? `lang ${locale}`);
          if (command) scrollToEntry(entry);
        } else initialLanguageError = true;
        status.textContent = content.ui.languageError;
        return false;
      } finally {
        if (request === languageVersion) languageChange = undefined;
      }
    })();
    let resume;
    const cancelled = new Promise(resolve => { resume = resolve; });
    languageChange = { promise: Promise.race([promise, cancelled]), resume };
    return promise;
  }
  function queueCommand(command) {
    const generation = startupVersion;
    queuedCommands++;
    commandQueue = commandQueue.then(async () => {
      try {
        while (generation === startupVersion && active() && languageChange)
          await languageChange.promise;
        if (generation === startupVersion && active()) renderCommand(command);
      } finally {
        if (generation === startupVersion) queuedCommands--;
      }
    });
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
    restorePromptAfterLink = false;
    cancelAnswer();
    languageVersion++;
    languageChange?.resume();
    languageChange = undefined;
    commandQueue = Promise.resolve();
    queuedCommands = 0;
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
    installation.setAttribute("lang", content.locale);
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
      renderInstruction(label, content.ui.installReady);
      input.disabled = false;
      terminalView.removeAttribute("aria-busy");
      welcome.removeAttribute("hidden");
      run("mtrajk intro", { remember: false });
      output.scrollTop = 0;
      status.textContent = content.ui.installReady;
      if (initialLanguageError) {
        initialLanguageError = false;
        appendEntry(renderResult({ type: "error", message: content.ui.languageError }, content), "lang");
        status.textContent = content.ui.languageError;
      }
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
    if (remember && command.trim()) {
      history.push(command);
      if (history.length > 100) history.shift();
    }
    cursor = history.length;
    draft = "";
    input.value = "";
    resetCompletion();
    refreshSuggestion();
    if (remember) focusPrompt();
    if (result.type === "language") void changeLanguage(result.locale, command);
    else if (languageChange || queuedCommands) queueCommand(command);
    else renderCommand(command);
  }
  function renderCommand(command) {
    const result = executeCommand(command, content);
    if (result.type === "clear") cancelAnswer();
    else answer?.reveal.finish();
    if (result.type === "help")
      result.items = [...result.items, { command: "mtrajk cv", description: content.ui.webCv }];
    if (result.type === "clear") {
      transcript.replaceChildren();
      welcome.setAttribute("hidden", "");
      installation.hidden = true;
      output.scrollTop = 0;
      status.textContent = content.ui.cleared;
    } else {
      const response = renderResult(result, content);
      const entry = appendEntry(response, command);
      if (result.type === "sections" && result.command !== "all" && !motion.matches)
        revealAnswer(response, command);
      else status.textContent = interpolate(content.ui.resultReady, { command });
      scrollToEntry(entry);
    }
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
  welcome.setAttribute("lang", content.locale);
  updateTerminalUi();
  return {
    enter,
    leave,
    focus: focusPrompt,
    applyLocaleUrl,
    restoreLanguage: locale => changeLanguage(locale, undefined, false),
    get locale() {
      return content.locale;
    },
    get ui() {
      return content.ui;
    },
    get started() {
      return started;
    },
  };
}
