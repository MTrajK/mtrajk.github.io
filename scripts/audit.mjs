import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import { root } from "./content.mjs";

const portReservation = createServer();
await new Promise((done) =>
  portReservation.listen(0, "127.0.0.1", () => done(undefined)),
);
const address = portReservation.address();
if (!address || typeof address === "string")
  throw new Error("Cannot allocate audit port");
const port = address.port;
await new Promise((resolve) => portReservation.close(resolve));
const browser = await chromium.launch({
  headless: true,
  args: [`--remote-debugging-port=${port}`],
});
await mkdir(resolve(root, ".artifacts"), { recursive: true });
try {
  for (const [name, path] of [
    ["en", "/?mode=cv"],
    ["mk", "/mk/?mode=cv"],
    ["dev", "/?mode=dev"],
  ]) {
    const result = await lighthouse(`http://127.0.0.1:5180${path}`, {
      port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    await writeFile(
      resolve(root, `.artifacts/lighthouse-${name}.json`),
      result.report,
    );
    const report = result.lhr;
    const scores = Object.fromEntries(
      Object.entries(report.categories).map(([id, category]) => [
        id,
        Math.round(category.score * 100),
      ]),
    );
    console.log(
      JSON.stringify({
        view: name,
        scores,
        lcpMs: report.audits["largest-contentful-paint"].numericValue,
        cls: report.audits["cumulative-layout-shift"].numericValue,
        tbtMs: report.audits["total-blocking-time"].numericValue,
      }),
    );
    if (report.categories.performance.score < 0.95) process.exitCode = 1;
  }
} finally {
  await browser.close();
}
