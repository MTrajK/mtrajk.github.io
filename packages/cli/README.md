# mtrajk

A bilingual CV for Meto Trajkovski, using the same content and commands as the CV/DEV website.

This is an unpublished preview. Package name ownership, content, portrait, translations, and publication still require owner approval. The package is intentionally marked private.

## Local use

From the repository root, run `npm ci` and `npm run build:cli`, then:

```sh
node packages/cli/dist/cli.js about --offline
node packages/cli/dist/cli.js projects --lang mk --json --offline
node packages/cli/dist/cli.js
```

The last command starts an interactive prompt only with terminal input/output. Otherwise it prints an introduction and help and exits.

Commands: `help`, `intro`, `about`, `experience`, `strengths`, `skills`, `how-i-work`, `projects`, `hobbies`, `contact`, `all`, `lang en`, `lang mk`, and interactive `clear`. Bare commands and the optional `mtrajk` prefix work in the prompt. Aliases: `whoami`, `work`, `github`.

Flags: `--lang en|mk`, `--offline`, `--json`, `--no-color`, `--help`, `--version`. `NO_COLOR` is respected. Diagnostics go to stderr; `--json` writes only JSON to stdout. Unknown input exits with status 2; unrecoverable content errors with status 1. A valid offline fallback is success.

Requires Node 24 or later. The same tarball can run with Bun. `bunx` normally follows the Node shebang; `bunx --bun` requests the Bun runtime. No install scripts, runtime dependencies, telemetry, or shell execution.

Online commands fetch fixed HTTPS locale endpoints under `/data/v1/` with a two-second timeout and a 256 KiB limit. Invalid/unavailable remote data falls back to bundled snapshots. `--offline` suppresses content requests but cannot eliminate an initial npm package download. Fallback snapshots age until the next package release; the diagnostic includes their review date.

The CLI never opens links automatically. ASCII art appears on interactive startup and TTY introductions, not in machine-readable output.

Apache-2.0. See LICENSE.
