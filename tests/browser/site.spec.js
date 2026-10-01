import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const openDev = async (page) => {
  await page.getByRole("button", { name: "DEV", exact: true }).click();
  await expect(page.locator("#dev-view")).toBeVisible();
};

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
    await expect(portrait).toHaveAttribute("src", content.profile.portrait);
    await expect
      .poll(() =>
        portrait.evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    await expect(page.locator("#contact")).toContainText(
      "mtrajk [at] outlook.com",
    );
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
      `https://mtrajk.me${path}`,
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

test("mode precedence, context, locale links and history remain predictable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("mtrajk-mode", "dev");
  });
  await page.goto("/?mode=cv#projects");
  await expect(page.locator("#cv-view")).toBeVisible();
  await openDev(page);
  await expect(page.locator(".terminal-entry").last()).toContainText(
    "Coding Problems",
  );
  await page.locator("#command-input").fill("mtrajk lang mk");
  await page.locator("#command-input").press("Enter");
  await expect(page).toHaveURL(/\/mk\/\?mode=dev#projects/);
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
