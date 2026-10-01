import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { root, validators, loadContents } from "./content.mjs";

const require = createRequire(import.meta.url);
const standaloneCode = require("ajv/dist/standalone/index.js").default;
export async function generateValidator() {
  const { ajv, public: validate } = await validators();
  const result = await build({
    stdin: {
      contents: standaloneCode(ajv, validate),
      resolveDir: root,
      sourcefile: "validator-source.js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    minify: true,
    legalComments: "none",
  });
  await mkdir(new URL("../.generated/", import.meta.url), { recursive: true });
  for (const content of await loadContents())
    await writeFile(
      new URL(`../.generated/${content.locale}.json`, import.meta.url),
      JSON.stringify(content),
    );
  await writeFile(
    new URL("../.generated/validate.js", import.meta.url),
    result.outputFiles[0].text,
  );
  await writeFile(
    new URL("../.generated/validate.d.ts", import.meta.url),
    'import type { ValidateFunction } from "ajv";\ndeclare const validate: ValidateFunction;\nexport default validate;\n',
  );
}
await generateValidator();
