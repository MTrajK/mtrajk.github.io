import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const openDev = async (page) => {
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await expect(page.locator("#dev-view")).toBeVisible();
  await expect(page.locator("#command-input")).toBeEnabled();
};

test("DEV installation simulation disables input, repeats, and cancels cleanly", async ({ page }) => {
  await page.goto("/?mode=cv#projects");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const input = page.locator("#command-input");
  const dev = page.getByRole("button", { name: "DEV", exact: true });
  const cv = page.getByRole("button", { name: "CV", exact: true });
  await dev.click();
  await expect(page.locator("#terminal-install")).toContainText("npm install mtrajk");
  await expect(page.locator("#terminal-install")).toContainText("simulation");
  await expect(input).toBeDisabled();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page).toHaveURL(/\/\?mode=dev$/);
  await page.locator("#terminal-form").dispatchEvent("submit");
  await expect(page.locator(".terminal-entry")).toHaveCount(0);
  await page.clock.runFor(600);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  await page.clock.runFor(900);
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await cv.click();
  await expect(page).toHaveURL(/:\d+\/$/);
  await dev.click();
  await expect(input).toBeDisabled();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await cv.click();
  await page.clock.runFor(3000);
  await expect(page.locator("#cv-view")).toBeVisible();
  await expect(page.locator(".terminal-entry")).toHaveCount(0);
  await dev.click();
  await page.clock.runFor(1500);
  await expect(input).toBeEnabled();
});

for (const path of ["/", "/mk/"]) {
  test(`DEV answers reveal progressively, skip, and cancel in ${path}`, async ({ page }) => {
    await page.goto(`${path}?mode=dev`);
    const input = page.locator("#command-input");
    await expect(input).toBeFocused();
    const content = await (await page.request.get(`/data/v1/${path === "/" ? "en" : "mk"}.json`)).json();
    const now = new Date("2026-01-01T00:00:00Z");
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 10000));
    await input.press("Escape");
    const run = async command => {
      await input.fill(command);
      await input.press("Enter");
      return page.locator(".terminal-response").nth(await page.locator(".terminal-response").count() - 1);
    };
    const response = await run("about");
    await expect(response).toHaveAttribute("aria-busy", "true");
    await expect(response).toHaveText("");
    await expect(input).toBeEnabled();
    const status = await page.locator("#terminal-status").textContent();
    await page.clock.runFor(24);
    const partial = await response.textContent();
    expect(partial.length).toBeGreaterThan(0);
    await page.clock.runFor(120);
    expect((await response.textContent()).length).toBeGreaterThan(partial.length);
    await expect(page.locator("#terminal-status")).toHaveText(status);
    const output = page.locator("#terminal-output");
    await output.evaluate(node => { node.scrollTop = 0; });
    await page.clock.runFor(1200);
    await expect(response).not.toHaveAttribute("aria-busy", "true");
    await expect(response.locator("p")).toHaveText(content.sections.find(section => section.id === "about").paragraphs);
    expect(await output.evaluate(node => node.scrollTop)).toBe(0);
    const skipped = await run("experience");
    await expect(skipped).toHaveAttribute("aria-busy", "true");
    await page.getByRole("button", { name: content.ui.showAnswer, exact: true }).click();
    await expect(skipped).not.toHaveAttribute("aria-busy", "true");
    await expect(skipped).toContainText("Global Payments");
    await expect(input).toBeFocused();
    const previous = await run("about");
    await page.clock.runFor(24);
    const next = await run("contact");
    await expect(previous).not.toHaveAttribute("aria-busy", "true");
    await expect(previous.locator("p")).toHaveText(content.sections.find(section => section.id === "about").paragraphs);
    await expect(next).toHaveAttribute("aria-busy", "true");
    await input.press("Enter");
    await expect(next).not.toHaveAttribute("aria-busy", "true");
    await expect(next.locator("a").first()).toBeVisible();
    const escaped = await run("about");
    await input.press("Escape");
    await expect(escaped).not.toHaveAttribute("aria-busy", "true");
    const reduced = await run("about");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(reduced).not.toHaveAttribute("aria-busy", "true");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const command of ["all", "help", "unknown"]) {
      const instant = await run(command);
      await expect(instant).not.toHaveAttribute("aria-busy", "true");
      expect((await instant.textContent()).length).toBeGreaterThan(0);
    }
    await run("about");
    await run("clear");
    await page.clock.runFor(1500);
    await expect(page.locator(".terminal-entry")).toHaveCount(0);
    const cancelled = await run("about");
    await page.clock.runFor(24);
    const beforeLeave = await cancelled.textContent();
    await page.getByRole("button", { name: "CV", exact: true }).click();
    await page.clock.runFor(1500);
    await expect(page.locator("#cv-view")).toBeVisible();
    await expect(cancelled).toHaveText(beforeLeave);
    await expect(cancelled).not.toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".terminal-skip")).toHaveCount(0);
  });
}

test("reduced motion renders DEV answers immediately in both languages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/mk/"]) {
    await page.goto(`${path}?mode=dev`);
    const input = page.locator("#command-input");
    await expect(input).toBeFocused();
    await input.fill("about");
    await input.press("Enter");
    const response = page.locator(".terminal-response").last();
    await expect(response).not.toHaveAttribute("aria-busy", "true");
    await expect(response.locator("p").first()).not.toHaveText("");
    await expect(page.locator(".terminal-skip")).toHaveCount(0);
  }
});

test("web CV command has help and completion while results start at their command", async ({ page }) => {
  await page.goto("/?mode=dev#projects");
  const input = page.locator("#command-input");
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(/\/\?mode=dev$/);
  for (const command of ["all", "help", "contact"]) {
    await input.fill(command);
    await input.press("Enter");
    const entry = page.locator(".terminal-entry").last();
    await expect(entry.locator(".command-echo")).toBeInViewport();
    const position = await entry.evaluate(node => {
      const output = document.querySelector("#terminal-output");
      return node.getBoundingClientRect().top - output.getBoundingClientRect().top - parseFloat(getComputedStyle(output).paddingTop);
    });
    expect(Math.abs(position)).toBeLessThan(2);
    await expect(entry.locator(".command-echo")).toHaveCSS("font-weight", "600");
    if (command === "help") await expect(entry.locator("dt").last()).toHaveText("mtrajk cv");
  }
  await input.fill("cv extra");
  await input.press("Enter");
  await expect(page.locator(".terminal-error").last()).toBeVisible();
  await input.fill("mtrajk c");
  await input.press("Tab");
  await input.press("Tab");
  await input.press("Tab");
  await expect(input).toHaveValue("mtrajk cv");
  await input.press("Enter");
  await expect(page.locator("#cv-view")).toBeVisible();
  await expect(page).toHaveURL(/:\d+\/$/);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test("CV has no preview banner and underlines the section in view", async ({ page }) => {
  await page.goto("/?mode=cv");
  await expect(page.locator(".preview-banner")).toHaveCount(0);
  const current = page.locator('.section-nav a[aria-current="location"]');
  await expect(current).toHaveCount(0);
  for (const section of ["experience", "projects", "contact"]) {
    await page.locator(`.section-nav a[data-section="${section}"]`).click();
    await expect(current).toHaveAttribute("data-section", section);
    await expect(current).toHaveCSS("text-decoration-line", "underline");
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(current).toHaveCount(0);
});

for (const reducedMotion of ["no-preference", "reduce"]) {
  test(`phone navigation keeps the active section visible with ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    for (const path of ["/", "/mk/"]) {
      await page.goto(`${path}?mode=cv`);
      const nav = page.locator(".section-nav");
      for (const width of [320, 390, 600]) {
        await page.setViewportSize({ width, height: 844 });
        const rows = await nav.locator("a").evaluateAll(links =>
          links.map(link => link.getBoundingClientRect().top),
        );
        expect(new Set(rows).size).toBe(1);
        for (const section of ["contact", "how-i-work", "about"]) {
          const scroll = await page.evaluate(id => {
            const target = document.getElementById(id);
            const header = document.querySelector(".site-header");
            window.scrollTo(0, scrollY + target.getBoundingClientRect().top - header.getBoundingClientRect().height - 8);
            return scrollY;
          }, section);
          const active = nav.locator('a[aria-current="location"]');
          await expect(active).toHaveAttribute("data-section", section);
          await expect(active).toHaveCSS("text-decoration-line", "underline");
          await expect.poll(() => active.evaluate(link => {
            const item = link.getBoundingClientRect();
            const menu = link.parentElement.getBoundingClientRect();
            return item.left >= menu.left - 1 && item.right <= menu.right + 1;
          })).toBe(true);
          if (section === "contact")
            await expect.poll(() => nav.evaluate(node =>
              Math.abs(node.scrollLeft - (node.scrollWidth - node.clientWidth)),
            )).toBeLessThanOrEqual(1);
          if (section === "about")
            await expect.poll(() => nav.evaluate(node => node.scrollLeft)).toBeLessThanOrEqual(1);
          expect(await page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(nav.locator('a[aria-current="location"]')).toHaveAttribute("data-section", "contact");
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(nav.locator('a[aria-current="location"]')).toHaveCount(0);
      await expect.poll(() => nav.evaluate(node => node.scrollLeft)).toBeLessThanOrEqual(1);
    }
  });
}

test("reduced motion skips the timed animation and bare cv preserves the locale", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/mk/"]) {
    await page.goto(`${path}?mode=dev#experience`);
    const input = page.locator("#command-input");
    await expect(input).toBeFocused();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await expect(page.locator("#dev-view")).not.toHaveAttribute("aria-busy", "true");
    await input.fill("help");
    await input.press("Enter");
    await expect(page.locator(".help-list dt").last()).toHaveText("mtrajk cv");
    await input.fill("cv");
    await input.press("Enter");
    await expect(page.locator("#cv-view")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(path);
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe("");
  }
});

test("returning to CV cancels a pending DEV content load", async ({ page }) => {
  await page.goto("/?mode=cv#experience");
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/data/v1/**", async route => {
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await expect(page.locator("#mode-status")).toContainText("Opening DEV");
  await page.getByRole("button", { name: "CV", exact: true }).click();
  release();
  await expect(page.locator("#cv-view")).toBeVisible();
  await expect(page.locator("#dev-view")).toBeHidden();
  await expect(page).toHaveURL(/:\d+\/$/);
  await openDev(page);
  await expect(page.locator("#command-input")).toBeFocused();
  await expect(page.locator("#terminal-install")).toHaveCount(1);
});

test("Back restores the original CV even after DEV becomes the saved preference", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#cv-view")).toBeVisible();
  await openDev(page);
  await page.goBack();
  await expect(page.locator("#cv-view")).toBeVisible();
  await expect(page.locator("#dev-view")).toBeHidden();
});

test("portrait, email, and selected experience stay consistent in both modes", async ({
  page,
}) => {
  for (const path of ["/", "/mk/"]) {
    await page.goto(`${path}?mode=cv`);
    const content = await (
      await page.request.get(`/data/v1/${path === "/" ? "en" : "mk"}.json`)
    ).json();
    const portrait = page.locator(".portrait img");
    const howIWork = page.locator('.hero-actions a[href="#how-i-work"]');
    await expect(howIWork).toHaveText(content.ui.howIWorkCta + " ↓");
    await expect(page.locator('.hero-actions a[href="#projects"]')).toHaveCount(0);
    await expect(portrait).toHaveAttribute("src", content.profile.portrait);
    await expect
      .poll(() =>
        portrait.evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    const contactEmail = page.locator("#contact .contact-email");
    await expect(contactEmail).toContainText("mtrajk [at] outlook.com");
    await expect(contactEmail).toHaveCSS("text-decoration-line", "underline");
    await expect(contactEmail.locator("a")).toHaveCount(0);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(page.locator("#experience .experience-item")).toHaveCount(2);
    await expect(page.locator("#experience .period")).toHaveCount(0);
    await expect(page.locator("#experience")).not.toContainText(
      /Beazley|ProPay/,
    );
    await openDev(page);
    await expect(page.locator(".terminal-portrait")).toHaveCount(0);
    await expect(page.locator(".terminal-wordmark:visible")).toHaveCount(1);
    await page.locator("#command-input").fill("experience");
    await page.locator("#command-input").press("Enter");
    await expect(page.locator(".terminal-entry").last()).not.toContainText(
      content.ui.datesPending,
    );
    await expect(page.locator(".terminal-entry").last()).not.toContainText(
      /Beazley|ProPay/,
    );
    await page.locator("#command-input").fill("contact");
    await page.locator("#command-input").press("Enter");
    await expect(page.locator(".terminal-entry").last()).toContainText(
      "mtrajk [at] outlook.com",
    );
    await expect(page.locator('#dev-view a[href^="mailto:"]')).toHaveCount(0);
    const rawEmail = ["mtrajk", "outlook.com"].join("@");
    expect(JSON.stringify(content)).not.toContain(rawEmail);
    expect(await page.content()).not.toContain(rawEmail);
  }
});

test("static CV and localized navigation work without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [path, name] of [
    ["/", "Meto"],
    ["/mk/", "Мето"],
  ]) {
    await page.goto(path);
    const content = await (
      await page.request.get(`/data/v1/${path === "/" ? "en" : "mk"}.json`)
    ).json();
    await expect(page.locator("h1").first()).toContainText(name);
    await expect(page.locator("#cv-view>section")).toHaveCount(8);
    await expect(
      page.locator('#projects a[href*="coding-problems"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "DEV", exact: true }),
    ).toBeDisabled();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${content.siteUrl}${path}`,
    );
  }
  await page.locator('a[data-locale="en"]').click();
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});

test("every command works in both locales with safe output and no page errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of ["/?mode=dev", "/mk/?mode=dev"]) {
    await page.goto(path);
    await expect(page.locator("#dev-view")).toBeVisible();
    for (const command of [
      "about",
      "experience",
      "strengths",
      "skills",
      "how-i-work",
      "projects",
      "hobbies",
      "contact",
      "all",
      "help",
    ]) {
      await page.locator("#command-input").fill(`mtrajk ${command}`);
      await page.locator("#terminal-form").press("Enter");
      await expect(page.locator(".terminal-entry").last()).toContainText(
        `mtrajk ${command}`,
      );
      await expect(
        page.locator(".terminal-entry").last().locator(".terminal-error"),
      ).toHaveCount(0);
    }
    await page.locator("#command-input").fill("<img src=x onerror=alert(1)>");
    await page.locator("#command-input").press("Enter");
    await expect(page.locator("#transcript img")).toHaveCount(0);
    await expect(page.locator(".terminal-error")).toHaveCount(1);
    await page.locator("#command-input").fill("clear");
    await page.locator("#command-input").press("Enter");
    await expect(page.locator(".terminal-entry")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("inline completion accepts, cycles, preserves history and provides keyboard escape", async ({
  page,
}) => {
  await page.goto("/?mode=dev");
  const input = page.locator("#command-input");
  await expect(input).toBeVisible();
  await input.fill("about");
  await input.press("Enter");
  await input.fill("draft");
  await input.press("ArrowUp");
  await expect(input).toHaveValue("about");
  await input.press("ArrowDown");
  await expect(input).toHaveValue("draft");
  await input.fill("exp");
  await expect(page.locator("#ghost-suffix")).toHaveText("erience");
  await input.press("ArrowRight");
  await expect(input).toHaveValue("experience");
  await input.press("Enter");
  await expect(page.locator(".terminal-entry").last()).toContainText(
    "Global Payments",
  );
  await input.fill("mtrajk a");
  await input.press("Tab");
  await expect(input).toHaveValue("mtrajk about");
  await input.press("Tab");
  await expect(input).toHaveValue("mtrajk all");
  await input.press("Shift+Tab");
  await expect(input).not.toBeFocused();
  await input.fill("exp");
  await input.press("Escape");
  await expect(page.locator("#ghost-suffix")).toBeEmpty();
  await page.evaluate(() => {
    const next = document.createElement("input");
    next.id = "native-tab-target";
    next.type = "text";
    next.setAttribute("aria-label", "Focus test target");
    document.body.append(next);
  });
  await input.press("Tab");
  await expect(page.locator("#native-tab-target")).toBeFocused();
  await page.locator("#native-tab-target").evaluate((node) => node.remove());
  await input.fill("exp");
  await input.press("Home");
  await input.press("ArrowRight");
  await expect(input).toHaveValue("exp");
  await input.press("End");
  await input.press("Tab");
  await expect(input).toHaveValue("experience");
  await input.fill("lang m");
  await expect(page.locator("#ghost-suffix")).toHaveText("k");
  await input.fill("exp");
  await input.press("Enter");
  await expect(
    page.locator(".terminal-entry").last().locator(".terminal-error"),
  ).toBeVisible();
});

test("prompt stays at the viewport bottom and focused after commands and clear", async ({
  page,
}) => {
  for (const path of ["/", "/mk/"]) {
    await page.goto(`${path}?mode=dev`);
    const input = page.locator("#command-input");
    await expect(input).toBeFocused();
    const panel = page.locator("#terminal-input-panel");
    const initial = await panel.boundingBox();
    const viewport = await page.evaluate(() => ({
      top: visualViewport?.offsetTop ?? 0,
      height: visualViewport?.height ?? innerHeight,
    }));
    expect(initial.y + initial.height).toBeCloseTo(
      viewport.top + viewport.height,
      0,
    );
    await expect(panel).toHaveCSS("border-top-style", "solid");
    await input.fill("all");
    await input.press("Enter");
    await expect(input).toBeFocused();
    await expect(page.locator("#terminal-hint")).toBeInViewport();
    const afterOutput = await panel.boundingBox();
    expect(afterOutput.y).toBeCloseTo(initial.y, 0);
    const output = page.locator("#terminal-output");
    await output.evaluate((node) => {
      node.scrollTop = 0;
    });
    expect((await panel.boundingBox()).y).toBeCloseTo(initial.y, 0);
    await input.fill("clear");
    await input.press("Enter");
    await expect(input).toBeFocused();
    expect((await panel.boundingBox()).y).toBeCloseTo(initial.y, 0);
    await expect(page.locator(".terminal-entry")).toHaveCount(0);
    await page.getByRole("button", { name: "DEV", exact: true }).focus();
    await output.click({ position: { x: 12, y: 110 } });
    await expect(input).toBeFocused();
  }
});

test("prompt remains visible on short and narrow viewports without stealing selection or link focus", async ({
  page,
}) => {
  await page.goto("/?mode=dev");
  const input = page.locator("#command-input");
  await expect(input).toBeFocused();
  await input.fill("all");
  await input.press("Enter");
  for (const viewport of [
    { width: 320, height: 480 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(input).toBeInViewport();
    await expect(page.locator("#terminal-hint")).toBeInViewport();
    await expect
      .poll(async () => {
        const panel = await page.locator("#terminal-input-panel").boundingBox();
        const bottom = await page.evaluate(
          () => visualViewport.offsetTop + visualViewport.height,
        );
        return Math.abs(panel.y + panel.height - bottom);
      })
      .toBeLessThan(1);
    const output = await page.locator("#terminal-output").boundingBox();
    const panel = await page.locator("#terminal-input-panel").boundingBox();
    expect(output.y + output.height).toBeCloseTo(panel.y, 0);
    expect(
      await page.evaluate(
        () => document.scrollingElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);
  }
  const link = page.locator("#transcript a").first();
  await link.focus();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(link).toBeFocused();
  const output = page.locator("#terminal-output");
  await output.focus();
  const selected = await output.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(
      node.querySelector(".terminal-entry:last-child .command-echo"),
    );
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return selection.toString();
  });
  expect(selected).toContain("all");
  await expect(output).toBeFocused();
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await page.getByRole("button", { name: "CV", exact: true }).click();
  await expect(page.locator("#cv-view")).toBeVisible();
  await openDev(page);
  await expect(input).toBeFocused();
});

test("DEV is a full-width terminal with one vertical scroll and only the floating toggle", async ({
  page,
}) => {
  await page.goto("/?mode=dev");
  await expect(page.locator("#dev-view")).toBeVisible();
  for (const selector of [
    ".site-header",
    ".site-footer",
    ".preview-banner",
    ".skip-link",
  ])
    await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator("#dev-controls")).toBeVisible();
  await expect(page.locator("button:visible")).toHaveCount(2);
  await expect(page.locator("#dev-view button")).toHaveCount(0);
  await expect(
    page.locator(
      ".terminal-bar, .dev-heading, #terminal-shortcuts, #command-suggestions",
    ),
  ).toHaveCount(0);
  await page.locator("#command-input").fill("all");
  await page.locator("#command-input").press("Enter");
  const dimensions = await page.evaluate(() => {
    const main = document.querySelector("#dev-main").getBoundingClientRect();
    const transcript = document.querySelector("#transcript");
    const nested = [
      ...document.querySelectorAll("#dev-view, #dev-view *"),
    ].filter(
      (node) =>
        /auto|scroll/.test(getComputedStyle(node).overflowY) &&
        node.scrollHeight > node.clientHeight + 1,
    );
    return {
      width: main.width,
      viewport: document.documentElement.clientWidth,
      nested: nested.map((node) => node.id),
      transcriptFits: transcript.scrollHeight <= transcript.clientHeight + 1,
      pageScrolls:
        document.scrollingElement.scrollHeight > window.innerHeight + 1,
    };
  });
  expect(dimensions.width).toBeCloseTo(dimensions.viewport, 0);
  expect(dimensions.nested).toEqual(["terminal-output"]);
  expect(dimensions.transcriptFits).toBe(true);
  expect(dimensions.pageScrolls).toBe(false);
  await expect(page.locator("#dev-controls")).toHaveCSS("position", "fixed");
  await page.locator("#command-input").fill("clear");
  await page.locator("#command-input").press("Enter");
  await expect(page.locator("#terminal-welcome")).toBeHidden();
  await page.getByRole("button", { name: "CV", exact: true }).click();
  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeVisible();
  await expect(page.locator("#mode-slot .mode-controls")).toBeVisible();
});

for (const exit of ["button", "command"]) {
  test(`returning to CV follows the selected language using the ${exit}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [initial, selected] of [["en", "mk"], ["mk", "en"], ["en", "en"], ["mk", "mk"]]) {
      const initialPath = initial === "mk" ? "/mk/" : "/";
      const selectedPath = selected === "mk" ? "/mk/" : "/";
      await page.goto(`${initialPath}?mode=cv`);
      await expect(page.locator("#cv-view")).toBeVisible();
      await page.evaluate(() => { document.documentElement.dataset.cvSessionMarker = "original-page"; });
      const content = await (await page.request.get(`/data/v1/${selected}.json`)).json();
      await openDev(page);
      const input = page.locator("#command-input");
      if (selected !== initial) {
        await input.fill(`lang ${selected}`);
        await input.press("Enter");
        await expect(page.locator("#dev-view")).toHaveAttribute("lang", selected);
      }
      if (exit === "button") await page.getByRole("button", { name: "CV", exact: true }).click();
      else {
        await input.fill("cv");
        await input.press("Enter");
      }
      await expect(page.locator("#cv-view")).toBeVisible();
      await expect(page.locator("#dev-view")).toBeHidden();
      await expect(page.locator("html")).toHaveAttribute("lang", selected);
      await expect(page.locator("html")).toHaveAttribute("data-mode", "cv");
      expect(new URL(page.url()).pathname).toBe(selectedPath);
      expect(new URL(page.url()).searchParams.has("terminalLang")).toBe(false);
      await expect(page.locator("#about-title")).toHaveText(content.sections.find(section => section.id === "about").title);
      await expect(page.locator(`.languages a[data-locale="${selected}"]`)).toHaveAttribute("aria-current", "page");
      await expect(page).toHaveTitle(content.meta.title);
      if (selected === initial)
        await expect(page.locator("html")).toHaveAttribute("data-cv-session-marker", "original-page");
      await page.reload();
      await expect(page.locator("#cv-view")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", selected);
    }
  });
}

test("terminal language switches in place and CV adopts it only when leaving DEV", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [path, initial, selected] of [["/", "en", "mk"], ["/mk/", "mk", "en"]]) {
    await page.goto(`${path}?mode=dev`);
    const input = page.locator("#command-input");
    await expect(input).toBeFocused();
    const content = await (await page.request.get(`/data/v1/${selected}.json`)).json();
    await input.fill("all");
    await input.press("Enter");
    const previous = await page.locator("#transcript").textContent();
    const count = await page.locator(".terminal-entry").count();
    const output = page.locator("#terminal-output");
    await output.evaluate(node => { node.scrollTop = 0; });
    await page.evaluate(() => {
      const root = document.documentElement;
      root.dataset.sessionMarker = "same-document";
      root.dataset.cvFlashed = "false";
      new MutationObserver(records => {
        if (root.dataset.mode !== "dev" || records.some(record => record.oldValue === "cv"))
          root.dataset.cvFlashed = "true";
      }).observe(root, { attributes: true, attributeFilter: ["data-mode"], attributeOldValue: true });
    });
    const languageCommand = `${initial === "en" ? "mtrajk " : ""}lang ${selected}`;
    await input.fill(languageCommand);
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}\\?mode=dev&terminalLang=${selected}$`));
    await expect(page.locator("html")).toHaveAttribute("data-session-marker", "same-document");
    await expect(page.locator("html")).toHaveAttribute("data-cv-flashed", "false");
    await expect(page.locator(".terminal-entry").first()).toHaveAttribute("lang", initial);
    await expect(page.locator("html")).toHaveAttribute("lang", initial);
    await expect(page.locator("#dev-view")).toHaveAttribute("lang", selected);
    await expect(page.locator("#cv-view")).toBeHidden();
    await expect(page.locator("#terminal-hint")).toHaveText(`${content.terminal.messages.hint} ${content.ui.terminalSubtitle}`);
    await expect(input).toHaveAccessibleName(content.ui.inputLabel);
    await expect(input).toBeFocused();
    const languageEntry = page.locator(".terminal-entry").last();
    await expect(languageEntry.locator(".command-echo")).toBeInViewport();
    await expect(languageEntry.locator(".terminal-response")).toBeInViewport();
    const position = await languageEntry.evaluate(node => {
      const output = document.querySelector("#terminal-output");
      return node.getBoundingClientRect().top - output.getBoundingClientRect().top - parseFloat(getComputedStyle(output).paddingTop);
    });
    expect(Math.abs(position)).toBeLessThan(2);
    expect((await page.locator("#transcript").textContent()).startsWith(previous)).toBe(true);
    await expect(page.locator(".terminal-entry")).toHaveCount(count + 1);
    await expect(page.locator(".terminal-entry").last()).toHaveAttribute("lang", selected);
    await expect(page.locator(".terminal-entry").last()).toContainText(content.terminal.messages.languageChanged.replace("{locale}", selected));
    await input.press("ArrowUp");
    await expect(input).toHaveValue(languageCommand);
    await input.press("ArrowUp");
    await expect(input).toHaveValue("all");
    await input.fill("about");
    await input.press("Enter");
    await expect(page.locator(".terminal-entry").last()).toHaveAttribute("lang", selected);
    await expect(page.locator(".terminal-entry").last().locator("h2")).toHaveText(content.sections.find(section => section.id === "about").title);
    await page.reload();
    await expect(input).toBeFocused();
    await expect(page.locator("#dev-view")).toHaveAttribute("lang", selected);
    await expect(page.locator("#terminal-hint")).toHaveText(`${content.terminal.messages.hint} ${content.ui.terminalSubtitle}`);
    await input.fill("cv");
    await input.press("Enter");
    await expect(page.locator("#cv-view")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(selected === "mk" ? "/mk/" : "/");
    await expect(page.locator("#intro-title")).toContainText(selected === "en" ? "Meto" : "Мето");
  }
});

test("terminal language switches finish progressive answers and localize new reveal controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?mode=dev");
  const input = page.locator("#command-input");
  await expect(input).toBeFocused();
  const en = await (await page.request.get("/data/v1/en.json")).json();
  const mk = await (await page.request.get("/data/v1/mk.json")).json();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const now = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 10000));
  await input.fill("about");
  await input.press("Enter");
  const previous = page.locator(".terminal-entry").nth(1);
  await page.clock.runFor(24);
  await expect(previous.locator(".terminal-response")).toHaveAttribute("aria-busy", "true");
  await input.fill("lang mk");
  await input.press("Enter");
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "mk");
  await expect(previous.locator(".terminal-response")).not.toHaveAttribute("aria-busy", "true");
  await expect(previous.locator(".terminal-response p")).toHaveText(en.sections.find(section => section.id === "about").paragraphs);
  await expect(previous).toHaveAttribute("lang", "en");
  await input.fill("about");
  await input.press("Enter");
  await expect(page.getByRole("button", { name: mk.ui.showAnswer, exact: true })).toBeVisible();
  await expect(page.locator(".terminal-entry").last()).toHaveAttribute("lang", "mk");
  await input.press("Escape");
  await expect(page.locator(".terminal-entry").last().locator(".terminal-response p")).toHaveText(mk.sections.find(section => section.id === "about").paragraphs);
});

test("slow terminal language loads queue responses and preserve input drafts", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const now = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 10000));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route(/\/data\/v1\/mk(?:\.[a-f0-9]+)?\.json$/, async route => {
    requests++;
    await gate;
    await route.continue();
  });
  await page.goto("/?mode=dev");
  const input = page.locator("#command-input");
  await expect(input).toBeFocused();
  const content = await (await page.request.get("/data/v1/mk.json")).json();
  const count = await page.locator(".terminal-entry").count();
  for (const command of ["lang mk", "about", "help"]) {
    await input.fill(command);
    await input.press("Enter");
  }
  await input.fill("draft");
  await expect(input).toBeEnabled();
  await expect(page.locator(".terminal-entry")).toHaveCount(count);
  release();
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "mk");
  await expect(page.locator(".terminal-entry")).toHaveCount(count + 3);
  await expect(page.locator(".terminal-entry").nth(count + 1).locator("h2")).toHaveText(content.sections.find(section => section.id === "about").title);
  for (const entry of [count, count + 1, count + 2])
    await expect(page.locator(".terminal-entry").nth(entry)).toHaveAttribute("lang", "mk");
  await expect(input).toHaveValue("draft");
  await expect(input).toBeFocused();
  expect(requests).toBe(1);
});

test("the latest terminal language request wins and late loads cannot change CV mode", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const now = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 10000));
  let release;
  let gate = new Promise(resolve => { release = resolve; });
  const pattern = /\/data\/v1\/mk(?:\.[a-f0-9]+)?\.json$/;
  await page.route(pattern, async route => { await gate; await route.continue(); });
  await page.goto("/?mode=dev");
  const input = page.locator("#command-input");
  await expect(input).toBeFocused();
  for (const command of ["lang mk", "about", "lang en"]) {
    await input.fill(command);
    await input.press("Enter");
  }
  await expect(page.locator(".terminal-entry").last().locator("h2")).toHaveText("The person behind the code.");
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/\/\?mode=dev$/);
  const before = await page.locator("#transcript").textContent();
  release();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.mode)).toBe("dev");
  await input.fill("lang mk");
  await input.press("Enter");
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "mk");
  expect((await page.locator("#transcript").textContent()).startsWith(before)).toBe(true);
  gate = new Promise(resolve => { release = resolve; });
  await page.goto("/?mode=dev");
  await expect(input).toBeFocused();
  for (const command of ["lang mk", "about"]) {
    await input.fill(command);
    await input.press("Enter");
  }
  await page.getByRole("button", { name: "CV", exact: true }).click();
  await expect(page.locator("#cv-view")).toBeVisible();
  release();
  await page.unrouteAll({ behavior: "wait" });
  await openDev(page);
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/\/\?mode=dev$/);
  await expect(page.locator(".terminal-entry")).toHaveCount(1);
});

test("failed or mismatched terminal translations keep the session usable and allow retry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pattern = /\/data\/v1\/mk(?:\.[a-f0-9]+)?\.json$/;
  const original = await (await page.request.get("/data/v1/mk.json")).json();
  for (const failure of ["network", "version", "locale"]) {
    await page.route(pattern, async route => {
      if (failure === "network") await route.abort();
      else await route.fulfill({ json: {
        ...original,
        ...(failure === "version" ? { contentVersion: "0".repeat(64) } : { locale: "en" }),
      } });
    });
    await page.goto("/?mode=dev");
    const input = page.locator("#command-input");
    await expect(input).toBeFocused();
    await input.fill("all");
    await input.press("Enter");
    await input.fill("lang mk");
    await input.press("Enter");
    await expect(page.locator(".terminal-error").last()).toContainText("Couldn't change the terminal language");
    await expect(page.locator(".terminal-error").last()).toBeInViewport();
    const position = await page.locator(".terminal-entry").last().evaluate(node => {
      const output = document.querySelector("#terminal-output");
      return node.getBoundingClientRect().top - output.getBoundingClientRect().top - parseFloat(getComputedStyle(output).paddingTop);
    });
    expect(Math.abs(position)).toBeLessThan(2);
    await expect(page.locator("#dev-view")).toHaveAttribute("lang", "en");
    await expect(page).toHaveURL(/\/\?mode=dev$/);
    await input.fill("about");
    await input.press("Enter");
    await expect(page.locator(".terminal-entry").last().locator("h2")).toHaveText("The person behind the code.");
    await page.unroute(pattern);
    await input.fill("lang mk");
    await input.press("Enter");
    await expect(page.locator("#dev-view")).toHaveAttribute("lang", "mk");
    await expect(input).toBeFocused();
  }
  await page.route(pattern, route => route.abort());
  await page.goto("/?mode=dev&terminalLang=mk");
  await expect(page.locator("#command-input")).toBeFocused();
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "en");
  await expect(page.locator(".terminal-error").last()).toContainText("Couldn't change the terminal language");
  await expect(page).toHaveURL(/\/\?mode=dev$/);
});

test("terminal language URLs and browser history restore matching CV locales", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mk/?mode=dev&terminalLang=en");
  const input = page.locator("#command-input");
  await expect(input).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("lang", "mk");
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "en");
  await expect(page.locator("#terminal-hint")).toContainText("Enter runs");
  await page.goto("/?mode=dev&terminalLang=invalid");
  await expect(input).toBeFocused();
  await expect(page).toHaveURL(/\/\?mode=dev$/);
  await input.fill("lang mk");
  await input.press("Enter");
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "mk");
  await page.getByRole("button", { name: "CV", exact: true }).click();
  await openDev(page);
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "mk");
  await input.fill("lang en");
  await input.press("Enter");
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "CV", exact: true }).click();
  await expect(page.locator("#cv-view")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goBack();
  await expect(input).toBeFocused();
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "en");
  await page.goBack();
  await expect(page.locator("#cv-view")).toBeVisible();
  await page.goBack();
  await expect(input).toBeFocused();
  await expect(page.locator("#dev-view")).toHaveAttribute("lang", "mk");
  await expect(page).toHaveURL(/\/\?mode=dev&terminalLang=mk$/);
  await page.goForward();
  await expect(page.locator("#cv-view")).toBeVisible();
  await expect(page.locator("#intro-title")).toContainText("Мето");
});

test("mode precedence, clean URLs, locale links and history remain predictable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("mtrajk-mode", "dev");
  });
  await page.goto("/?mode=cv#projects");
  await expect(page.locator("#cv-view")).toBeVisible();
  await openDev(page);
  await expect(page).toHaveURL(/\/\?mode=dev$/);
  await expect(page.locator(".terminal-entry").last()).toContainText("mtrajk intro");
  await expect(page.locator(".terminal-entry").last()).not.toContainText("Coding Problems");
  await page.locator("#command-input").fill("mtrajk lang mk");
  await page.locator("#command-input").press("Enter");
  await expect(page).toHaveURL(/\/\?mode=dev&terminalLang=mk$/);
  await expect(page.locator("#dev-view")).toBeVisible();
  await page.getByRole("button", { name: "CV", exact: true }).click();
  await expect(page.locator("#cv-view")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#dev-view")).toBeVisible();
  await page.goto("/?mode=invalid");
  await expect(page.locator("#dev-view")).toBeVisible();
});

test("blocked storage and failed content requests never blank the CV", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
  });
  await page.route("**/data/v1/**", (route) => route.abort());
  await page.goto("/?mode=dev");
  await expect(page.locator("#mode-status")).toContainText("couldn't load");
  await expect(page.locator("#cv-view")).toBeVisible();
  await expect(page.locator("#dev-view")).toBeHidden();
  await page.unroute("**/data/v1/**");
  await openDev(page);
});

test("snapshot fallback accepts matching content but rejects deployment skew", async ({
  page,
}) => {
  await page.route(/\/data\/v1\/en\.[a-f0-9]+\.json$/, (route) =>
    route.abort(),
  );
  await page.goto("/?mode=dev");
  await expect(page.locator("#dev-view")).toBeVisible();
  await page.route("**/data/v1/en.json", async (route) => {
    const response = await route.fetch();
    const content = await response.json();
    content.contentVersion = "0".repeat(64);
    await route.fulfill({ json: content });
  });
  await page.reload();
  await expect(page.locator("#mode-status")).toContainText("couldn't load");
  await expect(page.locator("#cv-view")).toBeVisible();
});

test("both modes pass automated accessibility checks and narrow layouts do not overflow", async ({
  page,
}) => {
  for (const locale of ["/", "/mk/"]) {
    await page.goto(`${locale}?mode=cv`);
    for (const mode of ["cv", "dev"]) {
      if (mode === "dev") await openDev(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
      await page.setViewportSize({ width: 320, height: 740 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  }
});

test("CV topic grids stack and discipline artwork hides on phones", async ({ page }) => {
  for (const locale of ["/", "/mk/"]) {
    await page.goto(`${locale}?mode=cv`);
    for (const width of [320, 360, 390, 430, 600, 768, 844, 1280]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      const scene = page.locator("#hobbies .hobby-scene");
      if (width <= 600) await expect(scene).toBeHidden();
      else await expect(scene).toBeVisible();
      await expect(page.locator("#hobbies .section-content > p").first()).toBeVisible();
      for (const selector of [".strengths-list", ".how-i-work-list"]) {
        const items = await page.locator(`${selector} > li`).evaluateAll(nodes =>
          nodes.map(node => {
            const { x, y, width, height } = node.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
        expect(items.length).toBeGreaterThan(1);
        if (width <= 600) {
          for (let index = 1; index < items.length; index++) {
            expect(items[index].x).toBeCloseTo(items[0].x, 0);
            expect(items[index].width).toBeCloseTo(items[0].width, 0);
            expect(items[index].y).toBeGreaterThanOrEqual(items[index - 1].y + items[index - 1].height);
          }
        } else {
          expect(items[1].y).toBeCloseTo(items[0].y, 0);
          expect(items[1].x).toBeGreaterThan(items[0].x);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("DEV prompt stays beside its input across phone sizes and rotation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const locale of ["/", "/mk/"]) {
    await page.goto(`${locale}?mode=dev`);
    const input = page.locator("#command-input");
    await expect(input).toBeFocused();
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 360, height: 740 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
      { width: 390, height: 360 },
    ]) {
      await page.setViewportSize(viewport);
      const { label, field } = await input.evaluate(node => ({
        label: document.querySelector("#terminal-form label").getBoundingClientRect().toJSON(),
        field: node.getBoundingClientRect().toJSON(),
      }));
      expect(field.x).toBeGreaterThanOrEqual(label.x + label.width);
      expect(field.y).toBeLessThan(label.y + label.height);
      expect(field.y + field.height).toBeGreaterThan(label.y);
      expect(field.width).toBeGreaterThanOrEqual(96);
      expect(field.x + field.width).toBeLessThanOrEqual(viewport.width);
      await expect(input).toHaveCSS("font-size", "16px");
      await expect(input).toBeInViewport();
      await expect(page.locator("#terminal-hint")).toBeInViewport();
      await input.fill("mtrajk ".repeat(30));
      await input.press("End");
      await input.fill("exp");
      await expect(page.locator("#ghost-suffix")).toHaveText("erience");
      await input.press("ArrowRight");
      await expect(input).toHaveValue("experience");
      await input.press("Enter");
      await expect(page.locator(".terminal-entry").last()).toContainText("Global Payments");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator("#terminal-input-panel").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
  }
});

test("preview metadata, 404 and screenshots", async ({ page }, info) => {
  await page.goto("/");
  const content = await (await page.request.get("/data/v1/en.json")).json();
  if (content.preview)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
  else await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  expect(
    JSON.parse(
      await page.locator('script[type="application/ld+json"]').textContent(),
    )["@type"],
  ).toBe("Person");
  await page.screenshot({ path: info.outputPath("cv.png"), fullPage: true });
  await openDev(page);
  await page.screenshot({ path: info.outputPath("dev.png"), fullPage: true });
  const response = await page.goto("/does-not-exist");
  expect(response.status()).toBe(404);
  await expect(page.locator("h1")).toContainText("A path not taken");
});
