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
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { root, loadContents, digest } from "../scripts/content.mjs";
import sharp from "sharp";

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

test("device favicon files are copied unchanged without publishing design history", async () => {
  const files = ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "android-chrome-192x192.png", "android-chrome-512x512.png", "site.webmanifest"];
  const sizes = { "favicon-16x16.png": 16, "favicon-32x32.png": 32, "apple-touch-icon.png": 180, "android-chrome-192x192.png": 192, "android-chrome-512x512.png": 512 };
  const hrefs = {};
  for (const file of files) {
    const source = await readFile(resolve(root, "assets/favicon", file));
    const output = await readFile(resolve(root, "dist/assets/favicon", file));
    assert.deepEqual(output, source);
    hrefs[file] = `/assets/favicon/${file}?v=${digest(source).slice(0, 12)}`;
    if (sizes[file]) {
      const metadata = await sharp(output).metadata();
      assert.equal(metadata.format, "png");
      assert.equal(metadata.width, sizes[file]);
      assert.equal(metadata.height, sizes[file]);
    }
  }
  const ico = await readFile(resolve(root, "dist/favicon.ico"));
  assert.deepEqual(ico, await readFile(resolve(root, "assets/favicon/favicon.ico")));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  const manifest = JSON.parse(await readFile(resolve(root, "dist/assets/favicon/site.webmanifest"), "utf8"));
  assert.equal(manifest.name, "Meto Trajkovski");
  assert.equal(manifest.short_name, "mtrajk");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "browser");
  assert.deepEqual(manifest.icons, [
    { src: "android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    { src: "android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
  ]);
  await access(resolve(root, "assets/favicon/favicon designs"));
  await assert.rejects(access(resolve(root, "dist/assets/favicon/favicon designs")), { code: "ENOENT" });
  assert.deepEqual((await readdir(resolve(root, "dist/assets/favicon"))).sort(), [...files].sort());
  for (const page of ["dist/index.html", "dist/mk/index.html", "dist/404.html"]) {
    const html = await readFile(resolve(root, page), "utf8");
    for (const file of ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "site.webmanifest"])
      assert.ok(html.includes(hrefs[file]));
    assert.ok(!html.includes("/assets/favicon.svg"));
  }
});

test("the built social image is an unchanged copy of the approved static JPEG", async () => {
  const path = "assets/social/meto-trajkovski-social-card.jpg";
  const source = await readFile(resolve(root, path));
  const output = await readFile(resolve(root, "dist", path));
  assert.deepEqual(output, source);
  assert.ok(output.length < 102400);
  for (const page of ["dist/index.html", "dist/mk/index.html"]) {
    const html = await readFile(resolve(root, page), "utf8");
    assert.ok(html.includes(path));
    assert.ok(!html.includes("/assets/social-en.png"));
    assert.ok(!html.includes("/assets/social-mk.png"));
  }
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
