import {
  mkdir,
  readFile,
  writeFile,
  cp,
  readdir,
  unlink,
} from "node:fs/promises";
import { resolve, basename, dirname } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import sharp from "sharp";
import { root, loadContents, digest } from "./content.mjs";
import { renderPage, socialPreview, faviconFiles } from "../src/site/templates/page.js";
import "./generate-validator.mjs";

const contents = await loadContents({
  release: process.argv.includes("--release"),
});
const output = resolve(root, "dist");
await mkdir(resolve(output, "assets"), { recursive: true });
await mkdir(resolve(output, "data/v1"), { recursive: true });
await mkdir(resolve(output, "mk"), { recursive: true });
const js = await build({
  absWorkingDir: root,
  entryPoints: ["src/site/client/main.js"],
  outdir: "dist/assets",
  bundle: true,
  splitting: true,
  format: "esm",
  target: ["es2022"],
  platform: "browser",
  minify: true,
  metafile: true,
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  legalComments: "none",
});
const jsEntry = Object.entries(js.metafile.outputs).find(
  ([, item]) => item.entryPoint === "src/site/client/main.js",
)[0];
const css = await build({
  absWorkingDir: root,
  entryPoints: ["src/site/styles.css"],
  outdir: "dist/assets",
  bundle: true,
  minify: true,
  metafile: true,
  entryNames: "styles-[hash]",
  legalComments: "none",
});
const cssEntry = Object.keys(css.metafile.outputs)[0];
const faviconDirectory = resolve(root, "assets/favicon");
const faviconOutput = resolve(output, "assets/favicon");
await mkdir(faviconOutput, { recursive: true });
const favicons = {};
for (const file of faviconFiles) {
  const source = resolve(faviconDirectory, file);
  const data = await readFile(source);
  favicons[file] = `/assets/favicon/${file}?v=${digest(data).slice(0, 12)}`;
  await cp(source, resolve(faviconOutput, file));
}
await cp(resolve(faviconDirectory, "favicon.ico"), resolve(output, "favicon.ico"));
const assets = {
  js: `/assets/${basename(jsEntry)}`,
  favicons,
  css: `/assets/${basename(cssEntry)}`,
  contentVersions: Object.fromEntries(contents.map(content => [content.locale, content.contentVersion])),
};
await cp(resolve(root, "NOTICE"), resolve(output, "NOTICE.txt"));
const socialSource = resolve(root, socialPreview.path.slice(1));
const socialTarget = resolve(output, socialPreview.path.slice(1));
const socialMetadata = await sharp(socialSource).metadata();
if (socialMetadata.format !== "jpeg" || socialMetadata.width !== socialPreview.width || socialMetadata.height !== socialPreview.height)
  throw new Error("Social image must match the configured JPEG dimensions");
await mkdir(dirname(socialTarget), { recursive: true });
await cp(socialSource, socialTarget);
for (const content of contents) {
  const json = JSON.stringify(content);
  await writeFile(resolve(output, `data/v1/${content.locale}.json`), json);
  await writeFile(
    resolve(output, `data/v1/${content.locale}.${content.contentVersion}.json`),
    json,
  );
  await writeFile(
    resolve(output, content.locale === "en" ? "index.html" : "mk/index.html"),
    renderPage(content, assets),
  );
  if (content.profile.portrait) {
    const source = resolve(root, content.profile.portrait.slice(1));
    const target = resolve(output, content.profile.portrait.slice(1));
    await mkdir(resolve(target, ".."), { recursive: true });
    await cp(source, target);
  }
}
const currentSnapshots = new Set(
  contents.map((content) => `${content.locale}.${content.contentVersion}.json`),
);
for (const filename of await readdir(resolve(output, "data/v1"))) {
  const match = /^(en|mk)\.([a-f0-9]{64})\.json$/.exec(filename);
  if (!match || currentSnapshots.has(filename)) continue;
  const path = resolve(output, "data/v1", filename);
  const previous = JSON.parse(await readFile(path, "utf8"));
  if (
    previous.schemaVersion === 1 &&
    previous.locale === match[1] &&
    previous.contentVersion === match[2]
  )
    await unlink(path);
}
await writeFile(
  resolve(output, "404.html"),
  renderPage(contents[0], assets, { notFound: true }),
);
await writeFile(
  resolve(output, "robots.txt"),
  contents[0].preview
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nSitemap: ${contents[0].siteUrl}/sitemap.xml\n`,
);
await writeFile(
  resolve(output, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${contents.map((c) => `<url><loc>${c.siteUrl}${c.locale === "en" ? "/" : "/mk/"}</loc><lastmod>${c.updatedAt}</lastmod></url>`).join("")}</urlset>`,
);
await writeFile(resolve(output, ".nojekyll"), "");
const manifest = {
  content: contents.map((c) => ({
    locale: c.locale,
    digest: c.contentVersion,
  })),
  assets,
  buildDigest: digest(contents.map((c) => c.contentVersion)),
};
await writeFile(
  resolve(output, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
let totalJs = 0;
for (const path of Object.keys(js.metafile.outputs)) {
  const size = gzipSync(await readFile(resolve(root, path))).length;
  totalJs += size;
  console.log(`${basename(path)}: ${size} bytes gzip`);
  if (path === jsEntry && size > 10240)
    throw new Error("Initial JS exceeds 10 KiB gzip budget");
}
if (totalJs > 40960) throw new Error("Total JS exceeds 40 KiB gzip budget");
const cssSize = gzipSync(await readFile(resolve(root, cssEntry))).length;
if (cssSize > 30720) throw new Error("CSS exceeds 30 KiB gzip budget");
for (const file of await readdir(output))
  if (file === "docs" || file === "src")
    throw new Error("Unexpected private build artifact");
console.log(
  `Built both locales: JS ${totalJs} bytes gzip, CSS ${cssSize} bytes gzip. ${contents[0].preview ? "PREVIEW ONLY." : "Release content approved."}`,
);
