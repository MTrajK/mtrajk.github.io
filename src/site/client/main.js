const config = JSON.parse(document.querySelector("#site-data").textContent);
const cv = document.querySelector("#cv-view");
const dev = document.querySelector("#dev-view");
const cvMain = document.querySelector("#main");
const devMain = document.querySelector("#dev-main");
const status = document.querySelector("#mode-status");
const controls = [...document.querySelectorAll("button[data-mode]")];
const modeControls = document.querySelector(".mode-controls");
const modeSlot = document.querySelector("#mode-slot");
const floatingControls = document.querySelector("#dev-controls");
const sections = [...document.querySelectorAll("#cv-view>section")];
const sectionNav = document.querySelector(".section-nav");
const navigation = [...sectionNav.querySelectorAll("a")];
const header = document.querySelector(".site-header");
const shareDisclosures = [...document.querySelectorAll("details")].filter(
  (node) => node.classList.contains("share-control"),
);
const hoverShare = matchMedia("(hover: hover) and (pointer: fine)");
let terminal;
let initialization;
let activeMode = "cv";
let transition = 0;
let scrollFrame = 0;
const validMode = (value) => ["cv", "dev"].includes(value);
for (const disclosure of shareDisclosures) {
  const summary = disclosure.querySelector("summary");
  let hoverOpened = false;
  disclosure.addEventListener("pointerenter", (event) => {
    if (hoverShare.matches && event.pointerType === "mouse") {
      disclosure.open = true;
      hoverOpened = true;
    }
  });
  disclosure.addEventListener("pointerleave", () => {
    if (!disclosure.querySelector(":focus-visible")) {
      disclosure.open = false;
      hoverOpened = false;
    }
  });
  summary.addEventListener("click", (event) => {
    if (hoverOpened && disclosure.open && event.detail > 0) {
      event.preventDefault();
      hoverOpened = false;
    }
  });
  disclosure.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !disclosure.open) return;
    event.preventDefault();
    event.stopPropagation();
    disclosure.open = false;
    hoverOpened = false;
    summary.focus();
  });
}
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  for (const disclosure of shareDisclosures) {
    if (disclosure.open && !disclosure.contains(event.target)) {
      disclosure.open = false;
    }
  }
});
function saveMode(mode) {
  try {
    localStorage.setItem("mtrajk-mode", mode);
  } catch {}
}
function preferredMode(fromHistory = false) {
  const query = new URL(location.href).searchParams.get("mode");
  if (validMode(query)) return query;
  if (fromHistory && validMode(history.state?.mtrajkMode))
    return history.state.mtrajkMode;
  try {
    const saved = localStorage.getItem("mtrajk-mode");
    if (validMode(saved)) return saved;
  } catch {}
  return "cv";
}
function updateLocaleLinks() {
  for (const link of document.querySelectorAll("a[data-locale]")) {
    const url = new URL(
      link.getAttribute("data-locale") === "en" ? "/" : "/mk/",
      location.origin,
    );
    url.searchParams.set("mode", activeMode);
    if (activeMode === "cv" && config.sectionIds.includes(location.hash.slice(1)))
      url.hash = location.hash;
    link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  }
}
function updateModeLabels() {
  const ui = activeMode === "dev" ? terminal.ui : config.ui;
  const locale = activeMode === "dev" ? terminal.locale : config.locale;
  modeControls.setAttribute("aria-label", ui.modeLabel);
  modeControls.setAttribute("lang", locale);
  floatingControls.setAttribute("lang", locale);
}
function revealNavigation(link) {
  if (!link || sectionNav.scrollWidth <= sectionNav.clientWidth) return;
  const menu = sectionNav.getBoundingClientRect();
  const item = link.getBoundingClientRect();
  const offset = item.left < menu.left + 4 ? item.left - menu.left - 4
    : item.right > menu.right - 4 ? item.right - menu.right + 4 : 0;
  const left = link === navigation[0] ? 0
    : link === navigation.at(-1) ? sectionNav.scrollWidth - sectionNav.clientWidth
    : sectionNav.scrollLeft + offset;
  sectionNav.scrollTo({
    left,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
}
function updateNavigation() {
  scrollFrame = 0;
  if (activeMode !== "cv") return;
  const boundary = header.getBoundingClientRect().bottom + 24;
  let section = sections.filter((node) => node.getBoundingClientRect().top <= boundary).at(-1);
  if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2)
    section = sections.at(-1);
  const previous = navigation.find(link => link.hasAttribute("aria-current"));
  const current = navigation.find(link => link.getAttribute("data-section") === section?.id);
  for (const link of navigation) {
    if (link === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  if (current !== previous) revealNavigation(current ?? navigation[0]);
}
function scheduleNavigation() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateNavigation);
}
async function setMode(mode, { push = false, focus = false, fromHistory = false } = {}) {
  const request = ++transition;
  if (mode === "dev") {
    status.textContent = config.ui.loading;
    try {
      initialization ??= import("./terminal.js").then((module) =>
        module.createTerminal(config, () => {
          void setMode("cv", { push: true, focus: true });
        }, () => {
          updateModeLabels();
          updateLocaleLinks();
        }),
      );
      terminal = await initialization;
    } catch {
      initialization = undefined;
      if (request === transition) status.textContent = config.ui.loadError;
      return;
    }
  }
  if (request !== transition) return;
  if (mode === "dev" && fromHistory) {
    const locale = new URL(location.href).searchParams.get("terminalLang");
    await terminal.restoreLanguage(["en", "mk"].includes(locale) ? locale : config.locale);
    if (request !== transition) return;
  }
  if (mode === "cv" && push && activeMode === "dev" && terminal.locale !== config.locale) {
    const url = new URL(terminal.locale === "mk" ? "/mk/" : "/", location.origin);
    url.searchParams.set("mode", "cv");
    terminal.leave();
    saveMode("cv");
    location.assign(url.href);
    return;
  }
  const changed = activeMode !== mode;
  const entering = mode === "dev" && (changed || !terminal.started);
  status.textContent = "";
  if (mode === "cv") terminal?.leave();
  activeMode = mode;
  (mode === "dev" ? floatingControls : modeSlot).append(modeControls);
  floatingControls.toggleAttribute("hidden", mode !== "dev");
  for (const node of document.querySelectorAll(
    ".site-header, .site-footer, .skip-link",
  ))
    node.toggleAttribute("hidden", mode === "dev");
  document.documentElement.dataset.mode = mode;
  cvMain.toggleAttribute("hidden", mode !== "cv");
  devMain.toggleAttribute("hidden", mode !== "dev");
  cv.toggleAttribute("hidden", mode !== "cv");
  dev.toggleAttribute("hidden", mode !== "dev");
  for (const button of controls)
    button.setAttribute(
      "aria-pressed",
      String(button.getAttribute("data-mode") === mode),
    );
  const reset = changed || push || entering;
  const url = reset ? new URL(location.pathname, location.origin) : new URL(location.href);
  if (reset && mode === "dev") url.searchParams.set("mode", "dev");
  if (mode === "dev") terminal.applyLocaleUrl(url);
  updateModeLabels();
  history[push ? "pushState" : "replaceState"](
    { ...history.state, mtrajkMode: mode }, "", url,
  );
  if (push) saveMode(mode);
  updateLocaleLinks();
  if (entering) terminal.enter();
  else if (mode === "dev") terminal.focus();
  else {
    if (reset) window.scrollTo(0, 0);
    if (focus) {
      const target = document.querySelector("#intro h1");
      if (target instanceof HTMLElement) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
    requestAnimationFrame(() => {
      if (request !== transition) return;
      if (reset) window.scrollTo(0, 0);
      updateNavigation();
    });
  }
}
for (const button of controls) {
  button.removeAttribute("disabled");
  button.addEventListener("click", () => {
    const mode = button.getAttribute("data-mode");
    if (mode === activeMode && !status.textContent) return;
    void setMode(mode, { push: true, focus: true });
  });
}
window.addEventListener("popstate", () => {
  void setMode(preferredMode(true), { fromHistory: true });
});
window.addEventListener("hashchange", () => {
  updateLocaleLinks();
  scheduleNavigation();
});
window.addEventListener("scroll", scheduleNavigation, { passive: true });
window.addEventListener("resize", () => {
  if (activeMode === "cv")
    revealNavigation(navigation.find(link => link.hasAttribute("aria-current")) ?? navigation[0]);
  scheduleNavigation();
});
new ResizeObserver(scheduleNavigation).observe(cv);
void setMode(preferredMode());
