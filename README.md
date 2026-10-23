# mtrajk.github.io

A bilingual personal CV for Meto Trajkovski. The site has English (`/`) and Macedonian (`/mk/`) pages, an interactive DEV terminal, and a matching local Node CLI. It is a static site built for GitHub Pages.

## Requirements

- Node.js 24.20.0 LTS
- npm

## Run locally

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5180`. Use `/mk/` for Macedonian and `/?mode=dev` for the terminal. To build without starting the server, run `npm run build`.

## Validate and test

```sh
npm run validate:content
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
```

`npm run check` validates content, typechecks and lints the code, runs unit and package tests, and builds the site and CLI. Browser tests run separately.

## Edit content

- `content/common.json` contains shared facts, the site domain, links, section order, and artwork.
- `content/en.json` and `content/mk.json` contain localized text. Keep matching section and item IDs across both files and `common.json`.
- Schemas in `content/schema/` validate all source data. Content is plain text; rebuild after editing JSON.

## Architecture

```text
common.json + en.json + mk.json
             |
      validate and resolve
             |
     +-------+-----------+
     |       |           |
 static HTML locale JSON CLI snapshot
     |       |           |
    CV   DEV + core   CLI + core
```

The build generates static pages, locale data, and the CLI snapshot. CV content is present in HTML before JavaScript runs; DEV and the CLI share the command core.

## Local CLI

```sh
npm run build:cli
node packages/cli/dist/cli.js about --offline
node packages/cli/dist/cli.js
```

The CLI package is private and unpublished. `help` lists commands; add `--lang mk` to use Macedonian.
