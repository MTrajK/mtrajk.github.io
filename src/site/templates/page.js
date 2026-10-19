export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const socialPreview = Object.freeze({
  title: "Meto Trajkovski — Product-Minded Software Engineer & Technical Leader",
  path: "/assets/social/meto-trajkovski-social-card.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Anime-inspired portrait of Meto Trajkovski beside his name.",
});
export const faviconFiles = Object.freeze([
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "site.webmanifest",
]);
const e = escapeHtml;
const paragraphs = (values) =>
  values.map((value) => `<p>${e(value)}</p>`).join("");
const links = (values, className = "") =>
  values
    .map(
      (link) =>
        `<a class="${className}" href="${e(link.url)}" rel="noreferrer">${e(link.label)} <span aria-hidden="true">↗</span></a>`,
    )
    .join("");
const tags = (values) =>
  values.length
    ? `<ul class="tags">${values.map((value) => `<li>${e(value)}</li>`).join("")}</ul>`
    : "";
function renderItem(item, section, index, content) {
  const heading = `<h3>${e(item.title)}</h3><p class="item-subtitle">${e(item.subtitle)}</p>`;
  const body = `${paragraphs(item.paragraphs)}${tags(item.tags)}${item.links.length ? `<div class="item-links">${links(item.links)}</div>` : ""}`;
  const bullets = item.bullets.length
    ? `<ul class="bullets">${item.bullets.map((value) => `<li>${e(value)}</li>`).join("")}</ul>`
    : "";
  if (section.id === "experience")
    return `<li class="experience-item"><div class="experience-meta"><p class="organization">${e(item.organization || "")}</p><p>${e(content.ui.client)} · ${e(item.client || "")}</p></div><div>${heading}${body}${bullets ? `<details><summary>${e(content.ui.details)}</summary>${bullets}</details>` : ""}</div></li>`;
  return `<li class="${section.id}-item"><span class="item-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>${heading}${body}${bullets}</li>`;
}
export function renderSection(section, content) {
  const { ui, profile } = content;
  if (section.id === "intro") {
    const parts = profile.name.split(" ");
    const portrait = profile.portrait
      ? `<img src="${e(profile.portrait)}" alt="${e(ui.portraitAlt)}" width="320" height="320" fetchpriority="high">`
      : `<div class="portrait-placeholder" aria-hidden="true"><span>${e(ui.monogram)}</span><div class="portrait-orbit"></div></div>`;
    return `<section id="intro" class="hero" aria-labelledby="intro-title"><div class="hero-copy"><p class="eyebrow">${e(ui.role)}</p><p class="hello">${e(ui.hello)}</p><h1 id="intro-title">${e(parts.slice(0, -1).join(" "))}<br><em>${e(parts.at(-1))}.</em></h1><p class="headline">${e(profile.headline)}</p>${paragraphs(section.paragraphs)}<div class="hero-actions"><a class="button-primary" href="#contact">${e(ui.contactCta)} <span aria-hidden="true">↗</span></a><a class="text-link" href="#how-i-work">${e(ui.howIWorkCta)} <span aria-hidden="true">↓</span></a></div></div><figure class="portrait"><div class="portrait-frame">${portrait}</div><figcaption><span class="mono">@${e(profile.username)}</span><span>${e(profile.portrait ? ui.portraitAlt : ui.portraitPending)}</span></figcaption></figure><p class="motto"><span aria-hidden="true">↳</span> ${e(profile.motto)}</p></section>`;
  }
  const skillGroups = section.skills
    ? `<div class="skills"><h3>${e(ui.skills)}</h3><div class="skill-groups">${section.skills.map((group) => `<div><h4>${e(group.title)}</h4>${tags(group.values)}</div>`).join("")}</div></div>`
    : "";
  const list = section.items.length
    ? `<ol class="${section.id}-list">${section.items.map((item, index) => renderItem(item, section, index, content)).join("")}</ol>`
    : "";
  const contactEmail =
    section.id === "contact" && profile.email
      ? `${ui.email}: ${profile.email}`
      : "";
  const copy = section.paragraphs
    .filter((value) => value !== contactEmail)
    .map((value) => `<p>${e(value)}</p>`)
    .join("");
  const emailLink = profile.email
    ? [{ label: profile.email, url: `mailto:${profile.email}` }]
    : [];
  const contact =
    section.id === "contact"
      ? `<div class="contact-links">${links([...emailLink, ...section.links])}</div>${!profile.email ? `<p class="pending-note">${e(ui.emailPending)}</p>` : ""}`
      : "";
  const scene =
    section.id === "hobbies"
      ? `<pre class="hobby-scene" aria-hidden="true">${e(content.artwork.scene.join("\n"))}</pre>`
      : "";
  return `<section id="${section.id}" class="cv-section section-${section.id}" aria-labelledby="${section.id}-title"><header class="section-heading"><p class="eyebrow">${e(section.kicker)}</p><h2 id="${section.id}-title">${e(section.title)}</h2></header><div class="section-content">${copy}${list}${skillGroups}${scene}${contact}</div></section>`;
}
function head(content, assets, notFound) {
  const path = content.locale === "en" ? "/" : "/mk/";
  const canonical = `${content.siteUrl}${path}`;
  const title = notFound ? content.ui.notFoundTitle : content.meta.title;
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: content.profile.name,
    url: canonical,
    sameAs: content.sections
      .find((s) => s.id === "contact")
      .links.filter((link) => link.url.startsWith("https:"))
      .map((link) => link.url),
  }).replace(/</g, "\\u003c");
  const image = `${content.siteUrl}${socialPreview.path}`;
  const favicon = file => e(assets.favicons?.[file] ?? `/assets/favicon/${file}`);
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(content.meta.description)}">`,
    '<meta name="theme-color" content="#f7f5ef">',
    '<meta name="color-scheme" content="light dark">',
    content.preview || notFound ? '<meta name="robots" content="noindex,nofollow">' : "",
    `<link rel="canonical" href="${canonical}">`,
    `<link rel="alternate" hreflang="en" href="${content.siteUrl}/">`,
    `<link rel="alternate" hreflang="mk" href="${content.siteUrl}/mk/">`,
    `<link rel="alternate" hreflang="x-default" href="${content.siteUrl}/">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${e(socialPreview.title)}">`,
    `<meta property="og:description" content="${e(content.profile.headline)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:site_name" content="${e(content.ui.siteLabel)}">`,
    `<meta property="og:locale" content="${content.locale === "mk" ? "mk_MK" : "en_US"}">`,
    `<meta property="og:locale:alternate" content="${content.locale === "mk" ? "en_US" : "mk_MK"}">`,
    `<meta property="og:image" content="${e(image)}">`,
    `<meta property="og:image:type" content="${socialPreview.type}">`,
    `<meta property="og:image:width" content="${socialPreview.width}">`,
    `<meta property="og:image:height" content="${socialPreview.height}">`,
    `<meta property="og:image:alt" content="${e(socialPreview.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${e(socialPreview.title)}">`,
    `<meta name="twitter:description" content="${e(content.profile.headline)}">`,
    `<meta name="twitter:image" content="${e(image)}">`,
    `<meta name="twitter:image:alt" content="${e(socialPreview.alt)}">`,
    `<link rel="icon" href="${favicon("favicon.ico")}" type="image/x-icon">`,
    `<link rel="icon" href="${favicon("favicon-32x32.png")}" type="image/png" sizes="32x32">`,
    `<link rel="icon" href="${favicon("favicon-16x16.png")}" type="image/png" sizes="16x16">`,
    `<link rel="apple-touch-icon" href="${favicon("apple-touch-icon.png")}" sizes="180x180">`,
    `<link rel="manifest" href="${favicon("site.webmanifest")}">`,
    `<link rel="stylesheet" href="${assets.css}">`,
    `<script type="application/ld+json">${structured}</script>`,
  ].join("");
}
export function renderPage(content, assets, { notFound = false } = {}) {
  const { ui } = content;
  if (notFound)
    return `<!doctype html><html lang="${content.locale}"><head>${head(content, assets, true)}</head><body><main class="not-found"><p class="eyebrow">404</p><h1>${e(ui.notFoundTitle)}</h1><p>${e(ui.notFoundText)}</p><a class="button-primary" href="/">${e(ui.home)}</a></main></body></html>`;
  const bootstrap = JSON.stringify({
    locale: content.locale,
    contentVersion: content.contentVersion,
    contentVersions: assets.contentVersions ?? { [content.locale]: content.contentVersion },
    dataUrl: `/data/v1/${content.locale}.${content.contentVersion}.json`,
    ui,
    sectionIds: content.sections.map((s) => s.id),
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="${content.locale}" data-mode="cv"><head>${head(content, assets, false)}</head><body><a class="skip-link" href="#main">${e(ui.skip)}</a><header class="site-header"><div class="header-main"><a class="brand" href="${content.locale === "en" ? "/" : "/mk/"}" aria-label="${e(content.profile.name)}"><span class="brand-mark" aria-hidden="true">m<span>_</span></span><span>${e(content.profile.username)}<span class="brand-dot">.</span></span></a><span class="edition">${e(ui.edition)}</span><div class="header-controls"><div id="mode-slot"><div class="mode-controls" role="group" aria-label="${e(ui.modeLabel)}"><button type="button" data-mode="cv" aria-pressed="true" disabled>${e(ui.cv)}</button><button type="button" data-mode="dev" aria-pressed="false" disabled>${e(ui.dev)}</button></div></div><nav class="languages" aria-label="${e(ui.languageLabel)}"><a href="/" lang="en" data-locale="en" ${content.locale === "en" ? 'aria-current="page"' : ""}>${e(ui.english)}</a><span aria-hidden="true">/</span><a href="/mk/" lang="mk" data-locale="mk" ${content.locale === "mk" ? 'aria-current="page"' : ""}>${e(ui.macedonian)}</a></nav></div></div><nav class="section-nav" aria-label="${e(ui.navLabel)}">${content.sections
    .filter((s) => s.id !== "intro")
    .map(
      (s) =>
        `<a href="#${s.id}" data-section="${s.id}">${e(content.navigation[s.id])}</a>`,
    )
    .join(
      "",
    )}</nav></header><div id="dev-controls" hidden></div><main id="main" tabindex="-1"><p id="mode-status" class="mode-status" role="status" aria-live="polite"></p><div id="cv-view">${content.sections.map((section) => renderSection(section, content)).join("")}</div></main><main id="dev-main" hidden><section id="dev-view" hidden aria-labelledby="dev-title"><h1 id="dev-title" class="sr-only" tabindex="-1">${e(ui.terminalTitle)}</h1><div class="terminal-window"><div id="terminal-output" role="region" aria-label="${e(ui.transcript)}" tabindex="0"><div id="terminal-welcome"></div><div id="transcript"></div></div><div id="terminal-input-panel"><form id="terminal-form" autocomplete="off"><label for="command-input"><span class="sr-only">${e(ui.inputLabel)}</span><span aria-hidden="true">${e(ui.commandPrompt)}</span></label><div class="input-row"><div class="command-line"><div id="command-ghost" aria-hidden="true"><span id="ghost-prefix"></span><span id="ghost-suffix"></span></div><input id="command-input" name="command" type="text" maxlength="256" spellcheck="false" autocapitalize="off" enterkeyhint="send" aria-autocomplete="inline" aria-describedby="terminal-hint completion-status"></div></div></form><p id="terminal-hint"></p></div></div><p id="completion-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p><p id="terminal-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p></section></main><footer class="site-footer"><a class="brand" href="#intro">${e(ui.siteLabel)}</a><p>${e(ui.footer)}</p><a href="#intro">${e(ui.backTop)} <span aria-hidden="true">↑</span></a></footer><script id="site-data" type="application/json">${bootstrap}</script><script type="module" src="${assets.js}"></script></body></html>`;
}
