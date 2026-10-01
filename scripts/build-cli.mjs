import { build } from "esbuild";
import { mkdir, writeFile, copyFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { root, loadContents } from "./content.mjs";
import "./generate-validator.mjs";

const contents = await loadContents();
await mkdir(resolve(root, "packages/cli/dist"), { recursive: true });
for (const content of contents)
  await writeFile(
    resolve(root, `.generated/${content.locale}.json`),
    JSON.stringify(content),
  );
await build({
  absWorkingDir: root,
  entryPoints: ["src/cli/entry.js"],
  outfile: "packages/cli/dist/cli.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  minify: true,
  legalComments: "none",
  banner: { js: "#!/usr/bin/env node" },
});
await chmod(resolve(root, "packages/cli/dist/cli.js"), 0o755);
await copyFile(resolve(root, "LICENSE"), resolve(root, "packages/cli/LICENSE"));
await copyFile(resolve(root, "NOTICE"), resolve(root, "packages/cli/NOTICE"));
console.log(
  "Built self-contained preview CLI. Publishing remains blocked by private:true and owner approvals.",
);
