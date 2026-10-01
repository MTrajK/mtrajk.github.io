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
let terminal;
let initialization;
let activeMode = "cv";
let transition = 0;
const validMode = (value) => ["cv", "dev"].includes(value);
const currentSection = () =>
  config.sectionIds.includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "intro";
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
    url.hash = currentSection();
    link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  }
}
function navigateSection(section) {
  const url = new URL(location.href);
  url.hash = section;
  if (url.href !== location.href)
    history.pushState({ mtrajkMode: activeMode }, "", url);
  updateLocaleLinks();
}
async function setMode(
  mode,
  { push = false, focus = false, selectSection = false } = {},
) {
  const request = ++transition;
  if (mode === "dev") {
    status.textContent = config.ui.loading;
    try {
      initialization ??= import("./terminal.js").then((module) =>
        module.createTerminal(config, navigateSection),
      );
      terminal = await initialization;
    } catch {
      initialization = undefined;
      if (request === transition) status.textContent = config.ui.loadError;
      return;
    }
  }
  if (request !== transition) return;
  status.textContent = "";
  activeMode = mode;
  (mode === "dev" ? floatingControls : modeSlot).append(modeControls);
  floatingControls.toggleAttribute("hidden", mode !== "dev");
  for (const node of document.querySelectorAll(
    ".site-header, .site-footer, .preview-banner, .skip-link",
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
  if (push) {
    const url = new URL(location.href);
    url.searchParams.set("mode", mode);
    history.pushState({ mtrajkMode: mode }, "", url);
    saveMode(mode);
  } else {
    history.replaceState(
      { ...history.state, mtrajkMode: mode },
      "",
      location.href,
    );
  }
  updateLocaleLinks();
  if (
    mode === "dev" &&
    (selectSection ||
      terminal.section !== currentSection() ||
      !terminal.started)
  )
    terminal.run(`mtrajk ${currentSection()}`, {
      remember: false,
      navigate: false,
    });
  if (mode === "dev") terminal.focus();
  else if (focus) {
    const target = document.querySelector(
      `#${currentSection()} h1, #${currentSection()} h2`,
    );
    if (target instanceof HTMLElement) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start" });
    }
  }
}
for (const button of controls) {
  button.removeAttribute("disabled");
  button.addEventListener("click", () => {
    if (activeMode === "cv") {
      const section = [...document.querySelectorAll("#cv-view>section")]
        .filter((node) => node.getBoundingClientRect().top <= 180)
        .at(-1);
      if (section) {
        const url = new URL(location.href);
        url.hash = section.id;
        history.replaceState(
          { ...history.state, mtrajkMode: activeMode },
          "",
          url,
        );
      }
    }
    void setMode(button.getAttribute("data-mode"), { push: true, focus: true });
  });
}
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a[href^="#"]');
  if (!link || activeMode !== "dev") return;
  const id = link.getAttribute("href").slice(1);
  if (!config.sectionIds.includes(id)) return;
  event.preventDefault();
  navigateSection(id);
  terminal.run(`mtrajk ${id}`, { remember: false, navigate: false });
});
window.addEventListener("popstate", () => {
  void setMode(preferredMode(true), { selectSection: true });
});
window.addEventListener("hashchange", () => {
  updateLocaleLinks();
  if (
    activeMode === "dev" &&
    preferredMode(true) === "dev" &&
    terminal.section !== currentSection()
  )
    terminal.run(`mtrajk ${currentSection()}`, {
      remember: false,
      navigate: false,
    });
});
void setMode(preferredMode());
