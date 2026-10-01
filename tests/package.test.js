import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { root, loadContents } from "../scripts/content.mjs";

const runNpm = (args, cwd) =>
  execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

test("generated pages, snapshots, and CLI do not retain the raw contact address", async () => {
  const raw = ["mtrajk", "outlook.com"].join("@");
  const jsonFiles = (await readdir(resolve(root, "dist/data/v1"))).filter(
    (name) => name.endsWith(".json"),
  );
  assert.equal(jsonFiles.length, 4);
  const files = [
    "dist/index.html",
    "dist/mk/index.html",
    "packages/cli/dist/cli.js",
    ...jsonFiles.map((name) => `dist/data/v1/${name}`),
  ];
  for (const file of files)
    assert.ok(
      !(await readFile(resolve(root, file), "utf8")).includes(raw),
      file,
    );
});

test("packed CLI installs outside the monorepo and has no undeclared runtime dependencies", async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), "mtrajk-package-"));
  try {
    const packed = JSON.parse(
      runNpm(
        ["pack", "--json", "--pack-destination", fixture],
        resolve(root, "packages/cli"),
      ),
    )[0];
    for (const file of packed.files)
      assert.ok(
        [
          "package.json",
          "README.md",
          "LICENSE",
          "NOTICE",
          "dist/cli.js",
        ].includes(file.path),
        file.path,
      );
    assert.ok(packed.files.some((file) => file.path === "dist/cli.js"));
    const consumer = resolve(fixture, "consumer");
    await mkdir(consumer);
    await writeFile(resolve(consumer, "package.json"), '{"private":true}');
    runNpm(
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        resolve(fixture, packed.filename),
      ],
      consumer,
    );
    const cli = resolve(consumer, "node_modules/mtrajk/dist/cli.js");
    const code = await readFile(cli, "utf8");
    assert.ok(code.startsWith("#!/usr/bin/env node"));
    for (const locale of ["en", "mk"]) {
      const stdout = execFileSync(
        process.execPath,
        [cli, "projects", "--offline", "--json", "--lang", locale],
        { cwd: fixture, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      const result = JSON.parse(stdout);
      const content = (await loadContents()).find(
        (item) => item.locale === locale,
      );
      assert.deepEqual(
        result.sections[0],
        content.sections.find((section) => section.id === "projects"),
      );
    }
    const stdout = runNpm(
      ["exec", "--offline", "--", "mtrajk", "--version"],
      consumer,
    );
    const manifest = JSON.parse(
      await readFile(resolve(root, "packages/cli/package.json"), "utf8"),
    );
    assert.ok(stdout.includes(manifest.version));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
