import { runCli } from "./main.js";
import en from "../../.generated/en.json" with { type: "json" };
import mk from "../../.generated/mk.json" with { type: "json" };
import manifest from "../../packages/cli/package.json" with { type: "json" };

process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  else throw error;
});
process.exitCode = await runCli(process.argv.slice(2), {
  snapshots: { en, mk },
  version: manifest.version,
});
