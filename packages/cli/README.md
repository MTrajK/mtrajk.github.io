# mtrajk CLI

Version 1.0.0 of the local Node.js CLI for the bilingual CV. Requires Node.js 24 or later and is ready for owner publication.

From the repository root:

```sh
npm ci
npm run build:cli
node packages/cli/dist/cli.js about --offline
node packages/cli/dist/cli.js
```

The last command starts an interactive prompt when run in a terminal. Use `help` to list commands or add `--lang mk` for Macedonian. `--offline` uses the bundled content snapshot.

Apache-2.0. See LICENSE.
