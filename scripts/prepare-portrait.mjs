import sharp from "sharp";
import { mkdir, writeFile, rename, lstat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { root, readJson } from "./content.mjs";

const input = process.argv[2];
const options = process.argv.slice(3);
const apply = options.includes("--apply");
const moveSource = options.includes("--move-source");
if (
  !input ||
  options.some((option) => !["--apply", "--move-source"].includes(option)) ||
  (moveSource && !apply)
) {
  console.error(
    "Usage: npm run assets:portrait -- /path/to/owner-approved-image [--apply [--move-source]]",
  );
  process.exitCode = 1;
} else {
  const directory = resolve(
    root,
    apply ? "assets/portrait" : ".artifacts/portrait",
  );
  const source = resolve(input);
  const archive = resolve(directory, `source${extname(source).toLowerCase()}`);
  if (moveSource && source !== archive) {
    try {
      await lstat(archive);
      throw new Error(
        `Refusing to overwrite the existing source portrait: ${archive}`,
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const square = await sharp(source)
    .rotate()
    .resize(640, 640, { fit: "cover" })
    .png()
    .toBuffer();
  const image = sharp(square);
  await mkdir(directory, { recursive: true });
  await image
    .clone()
    .webp({ quality: 82 })
    .toFile(resolve(directory, "portrait.webp"));
  if (apply) {
    const common = await readJson("content/common.json");
    common.profile.portrait = "/assets/portrait/portrait.webp";
    await writeFile(
      resolve(root, "content/common.json"),
      `${JSON.stringify(common, null, 2)}\n`,
    );
    if (moveSource && source !== archive) await rename(source, archive);
    console.log(
      `Applied the approved portrait.${moveSource ? ` Source preserved at ${archive}.` : ""}`,
    );
  } else {
    console.log(
      "Prepared an optimized portrait in .artifacts/portrait without modifying public content. Use --apply only after reviewing the result.",
    );
  }
}
