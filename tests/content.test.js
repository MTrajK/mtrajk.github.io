import test from "node:test";
import assert from "node:assert/strict";
import { loadContents, readJson, validators } from "../scripts/content.mjs";
import { assertContent, fetchContent } from "../src/core/content.js";
import { renderPage, renderSection, escapeHtml } from "../src/site/templates/page.js";
import { executeCommand } from "../src/core/execute-command.js";
import { renderText, renderBanner } from "../src/cli/render-result.js";
import { access, stat } from "node:fs/promises";

const sources = async () => ({
  common: await readJson("content/common.json"),
  translations: await Promise.all(
    ["en", "mk"].map((id) => readJson(`content/${id}.json`)),
  ),
});

test("both languages resolve deterministically, and unfinished content blocks release", async () => {
  assert.deepEqual(await loadContents(), await loadContents());
  const data = await sources();
  data.common.approvals.content = false;
  await assert.rejects(
    loadContents({ ...data, release: true }),
    /Release blocked/,
  );
});

test("one common domain drives all generated website and terminal URLs", async () => {
  const data = await sources();
  const previousDomain = data.common.domain;
  assert.equal(previousDomain, "mtrajk.dev");
  data.common.domain = "mtrajk.test";
  for (const content of await loadContents(data)) {
    assert.equal(content.siteUrl, "https://mtrajk.test");
    assert.equal(content.ui.siteLabel, "mtrajk.test");
    assert.equal(content.ui.commandPrompt, "visitor@mtrajk.test:~$");
    const html = renderPage(content, { css: "/style.css", js: "/main.js" });
    assert.ok(html.includes("https://mtrajk.test"));
    assert.ok(!html.includes(previousDomain));
  }
  data.common.domain = "https://mtrajk.test/path";
  await assert.rejects(loadContents(data));
});

test("social metadata keeps its title and image fixed while descriptions follow the JSON headline", async () => {
  const socialTitle = "Meto Trajkovski — Product-Minded Software Engineer & Technical Leader";
  for (const original of await loadContents()) {
    const content = structuredClone(original);
    content.profile.headline = `${original.profile.headline} A "JSON" headline & <plain text>.`;
    content.meta.title = "A different browser title";
    const html = renderPage(content, { css: "/style.css", js: "/main.js" });
    const meta = (key, attribute = "property") => html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]*)">`))?.[1];
    for (const [attribute, prefix] of [["property", "og"], ["name", "twitter"]]) {
      assert.equal(meta(`${prefix}:title`, attribute), escapeHtml(socialTitle));
      assert.equal(meta(`${prefix}:description`, attribute), escapeHtml(content.profile.headline));
      assert.equal(meta(`${prefix}:image`, attribute), `${content.siteUrl}/assets/social/meto-trajkovski-social-card.jpg`);
      assert.equal(meta(`${prefix}:image:alt`, attribute), "Anime-inspired portrait of Meto Trajkovski beside his name.");
    }
    assert.equal(meta("description", "name"), escapeHtml(content.meta.description));
    assert.ok(html.includes("<title>A different browser title</title>"));
    assert.equal(meta("og:type"), "website");
    assert.equal(meta("og:site_name"), content.ui.siteLabel);
    assert.equal(meta("og:url"), `${content.siteUrl}${content.locale === "en" ? "/" : "/mk/"}`);
    assert.equal(meta("og:locale:alternate"), content.locale === "en" ? "mk_MK" : "en_US");
    assert.equal(meta("og:image:width"), "1200");
    assert.equal(meta("og:image:height"), "630");
    assert.equal(meta("og:image:type"), "image/jpeg");
    assert.equal(meta("twitter:card", "name"), "summary_large_image");
  }
});

test("selected experience omits dates and retired clients across CV and CLI", async () => {
  for (const content of await loadContents()) {
    const result = executeCommand("experience", content);
    assert.deepEqual(
      result.sections[0].items.map((item) => item.client),
      ["Global Payments", "3Shape"],
    );
    const html = renderPage(content, { css: "/style.css", js: "/main.js" });
    const text = renderText(result, content);
    assert.doesNotMatch(
      JSON.stringify(result),
      /Beazley|ProPay|endava-insurance/,
    );
    assert.ok(!html.includes('class="period"'));
    assert.ok(!text.includes(content.ui.datesPending));
    assert.match(
      text,
      content.locale === "en"
        ? /billions of dollars annually/
        : /милијарди долари годишно/,
    );
    assert.ok(
      content.sections
        .find((section) => section.id === "contact")
        .paragraphs.some((text) => text.includes("mtrajk [at] outlook.com")),
    );
  }
});

test("email stays obfuscated in content, HTML, CLI text and JSON, with social links intact", async () => {
  const raw = ["mtrajk", "outlook.com"].join("@");
  for (const content of await loadContents()) {
    assert.equal(content.profile.email, "mtrajk [at] outlook.com");
    const result = executeCommand("contact", content);
    const html = renderPage(content, { css: "/style.css", js: "/main.js" });
    for (const output of [
      JSON.stringify(content),
      html,
      JSON.stringify(result),
      renderText(result, content),
    ]) {
      assert.ok(output.includes("mtrajk [at] outlook.com"));
      assert.ok(!output.includes(raw));
      assert.ok(!output.includes("mailto:"));
    }
    assert.deepEqual(
      result.sections[0].links.map((link) => link.url),
      ["https://github.com/MTrajK", "https://www.linkedin.com/in/mtrajk/"],
    );
    const projects = content.sections.find(
      (section) => section.id === "projects",
    );
    assert.match(
      projects.paragraphs.join(" "),
      content.locale === "en"
        ? /before AI.*written manually/
        : /пред AI.*рачно/,
    );
  }
  const data = await sources();
  data.common.profile.email = raw;
  await assert.rejects(loadContents(data));
});

test("location and seasonal time-zone comparisons appear in Contact only across CV and CLI", async () => {
  for (const content of await loadContents()) {
    const result = executeCommand("contact", content);
    const contact = result.sections[0];
    const copy = contact.paragraphs.join(" ");
    assert.match(copy, content.locale === "en" ? /Skopje, North Macedonia/ : /Скопје, Северна Македонија/);
    for (const pattern of [/CET\/CEST/, /UTC\+1/, /UTC\+2/, /US Eastern/])
      assert.match(copy, pattern);
    assert.match(copy, content.locale === "en" ? /European working hours · US Eastern mornings/ : /европското работно време · утрински часови на US Eastern/);
    const html = renderSection(contact, content);
    const text = renderText(result, content).replace(/\s+/g, " ");
    for (const paragraph of contact.paragraphs) {
      assert.ok(html.includes(escapeHtml(paragraph)));
      assert.ok(text.includes(paragraph.replace(/\s+/g, " ")));
    }
    const intro = executeCommand("intro", content);
    const location = /Skopje|Скопје|CET\/CEST|UTC\+[12]|US Eastern/;
    assert.doesNotMatch(renderSection(intro.sections[0], content), location);
    assert.doesNotMatch(renderText(intro, content), location);
  }
});

test("approved selected experience can be released without employment periods", async () => {
  const data = await sources();
  for (const key of Object.keys(data.common.approvals))
    data.common.approvals[key] = true;
  assert.ok(data.common.records.experience.every((item) => !item.period));
  const contents = await loadContents({ ...data, release: true });
  assert.ok(contents.every((content) => !content.preview));
});

test("approved image portrait is relocated and optimized", async () => {
  const [content] = await loadContents();
  assert.equal(content.profile.portrait, "/assets/portrait/portrait.webp");
  await access(new URL("../assets/portrait/source.jpeg", import.meta.url));
  await assert.rejects(access(new URL("../potrait.jpeg", import.meta.url)), {
    code: "ENOENT",
  });
  assert.ok(
    (await stat(new URL("../assets/portrait/portrait.webp", import.meta.url)))
      .size < 102400,
  );
  assert.equal(renderBanner(content, 80), `${content.artwork.wordmark.join("\n")}\n`);
});

test("static HTML and command results share facts, and content cannot inject markup", async () => {
  for (const content of await loadContents()) {
    const html = renderPage(content, {
      css: "/assets/style.css",
      js: "/assets/main.js",
    });
    for (const section of executeCommand("all", content).sections) {
      for (const paragraph of [
        ...section.paragraphs,
        ...section.items.flatMap((item) => item.paragraphs),
      ])
        assert.ok(html.includes(escapeHtml(paragraph)));
    }
    const changed = structuredClone(content);
    changed.sections.find((s) => s.id === "about").paragraphs = [
      '<img src=x onerror="alert(1)">',
    ];
    const escaped = renderPage(changed, {
      css: "/assets/style.css",
      js: "/assets/main.js",
    });
    assert.ok(
      escaped.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"),
    );
    assert.ok(!escaped.includes("<img src=x"));
  }
});

test("schema, translation parity, stable IDs and unsafe content are enforced", async () => {
  for (const mutate of [
    (data) => {
      delete data.translations[1].ui.submit;
    },
    (data) => {
      data.translations[0].ui.extra = "bad";
    },
    (data) => {
      data.translations[1].sections[2].items.pop();
    },
    (data) => {
      data.common.records.projects[0].id = "missing";
    },
    (data) => {
      data.translations[0].sections[0].paragraphs = ["\x1b[31m"];
    },
    (data) => {
      data.common.contactLinks[0].url = "https://user:password@example.com";
    },
    (data) => {
      data.common.records.experience[0].period = {
        start: "2020-01",
        end: null,
        current: false,
      };
    },
    (data) => {
      data.common.records.experience[0].period = {
        start: "2020-01",
        end: "2019-01",
        current: false,
      };
    },
    (data) => {
      data.common.updatedAt = "2026-02-30";
    },
    (data) => {
      data.common.sectionOrder[1] = "intro";
    },
  ]) {
    const data = await sources();
    mutate(data);
    await assert.rejects(loadContents(data));
  }
});

test("JSON-only changes flow into shared content and repeatable records", async () => {
  const data = await sources();
  data.translations[0].sections[1].paragraphs[0] = "Changed only in JSON";
  const expectedCount = data.common.records.projects.length + 1;
  data.common.records.projects.push({ id: "new-project", tags: [], links: [] });
  for (const locale of data.translations)
    locale.sections
      .find((s) => s.id === "projects")
      .items.push({
        id: "new-project",
        title: "New project",
        subtitle: "From JSON",
        paragraphs: ["Description"],
        bullets: [],
      });
  const [content] = await loadContents(data);
  assert.equal(content.sections[1].paragraphs[0], "Changed only in JSON");
  assert.equal(
    content.sections.find((s) => s.id === "projects").items.length,
    expectedCount,
  );
});

test("public loader bounds responses and validates remote locale/version/schema", async () => {
  const [content] = await loadContents();
  const { public: validate } = await validators();
  const options = { locale: "en", validate, version: content.contentVersion };
  const endpoint = `${content.siteUrl}/data/v1/en.json`;
  const fetcher = async () => new Response(JSON.stringify(content));
  assert.deepEqual(
    await fetchContent(endpoint, {
      ...options,
      fetcher,
    }),
    content,
  );
  await assert.rejects(
    fetchContent(endpoint, {
      ...options,
      fetcher,
      locale: "mk",
    }),
    /mismatch/,
  );
  await assert.rejects(
    fetchContent(endpoint, {
      ...options,
      fetcher,
      version: "old",
    }),
    /mismatch/,
  );
  for (const response of [
    new Response("oops"),
    new Response("{}"),
    new Response("no", { status: 500 }),
    new Response("x".repeat(262145)),
    new Response("{}", { headers: { "content-length": "300000" } }),
  ]) {
    await assert.rejects(
      fetchContent(endpoint, {
        ...options,
        fetcher: async () => response,
      }),
    );
  }
  await assert.rejects(
    fetchContent(endpoint, {
      ...options,
      timeout: 5,
      fetcher: async (_url, { signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    }),
    /aborted/,
  );
  assert.throws(
    () => assertContent({ ...content, schemaVersion: 2 }, validate, "en"),
    /schema/,
  );
});
