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
  const convert = async (width) => {
    const height = Math.round(width * 0.48);
    const { data } = await image
      .clone()
      .resize(width, height, { fit: "fill" })
      .flatten({ background: "#ffffff" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ramp = "@%#*+=-:. ";
    return Array.from({ length: height }, (_, row) =>
      Array.from(
        { length: width },
        (_, col) =>
          ramp[
            Math.min(
              ramp.length - 1,
              Math.floor((data[row * width + col] / 256) * ramp.length),
            )
          ],
      ).join(""),
    );
  };
  const artwork = {
    portrait: await convert(56),
    portraitCompact: await convert(32),
  };
  await mkdir(directory, { recursive: true });
  await image
    .clone()
    .webp({ quality: 82 })
    .toFile(resolve(directory, "portrait.webp"));
  if (apply) {
    const common = await readJson("content/common.json");
    common.profile.portrait = "/assets/portrait/portrait.webp";
    common.artwork = { ...common.artwork, ...artwork };
    common.approvals.portrait = true;
    await writeFile(
      resolve(root, "content/common.json"),
      `${JSON.stringify(common, null, 2)}\n`,
    );
    if (moveSource && source !== archive) await rename(source, archive);
    console.log(
      `Applied the approved portrait and shared ASCII artwork.${moveSource ? ` Source preserved at ${archive}.` : ""}`,
    );
  } else {
    await writeFile(
      resolve(directory, "ascii.json"),
      JSON.stringify(artwork, null, 2),
    );
    console.log(
      "Prepared private review outputs in .artifacts/portrait. Public content and approvals are unchanged. Use --apply only with owner approval.",
    );
  }
}
