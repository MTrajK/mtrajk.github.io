import { readFile } from "node:fs/promises";
import { loadContents, readJson } from "./content.mjs";
import { fetchContent } from "../src/core/content.js";
import validate from "../.generated/validate.js";

const manifest = await readJson("packages/cli/package.json");
if (manifest.private || manifest.version.includes("preview"))
  throw new Error(
    "Owner must approve package ownership, public status, and a release version before publishing",
  );
const contents = await loadContents();
for (const content of contents) {
  await fetchContent(`${content.siteUrl}/data/v1/${content.locale}.json`, {
    locale: content.locale,
    validate,
    version: content.contentVersion,
    timeout: 10000,
  });
}
const binary = await readFile(
  new URL("../packages/cli/dist/cli.js", import.meta.url),
  "utf8",
);
if (!binary.startsWith("#!/usr/bin/env node"))
  throw new Error("CLI entry point is invalid");
console.log(
  `Release verified: ${manifest.name}@${manifest.version}; both public content snapshots match.`,
);
