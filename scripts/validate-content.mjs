import { loadContents } from "./content.mjs";
try {
  const contents = await loadContents({
    release: process.argv.includes("--release"),
  });
  for (const content of contents)
    console.log(
      `${content.locale}: valid content (${content.contentVersion.slice(0, 12)})`,
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
