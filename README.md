# mtrajk.github.io

Meto Trajkovski's bilingual, JSON-authored CV: a warm static CV, an interactive DEV presentation, and a matching Node/Bun CLI. Built for GitHub Pages at the domain configured in `content/common.json`, with semantic HTML, plain CSS, and vanilla JavaScript. No application framework, backend, tracking, runtime AI, or simulated shell.

## Current status

This is a working **preview, not a published release**. The owner's portrait and confirmed email are integrated. Experience is a curated selection of Global Payments and 3Shape engagements, not a complete work history; employment dates and job titles are intentionally omitted. Projects are a selection of personal projects, not a complete portfolio. Final editorial/Macedonian review, npm ownership, and publication authorization remain owner tasks.

Preview pages are marked `noindex` and robots disallows crawling; the visible CV preview banner is intentionally omitted. `npm run validate:release` intentionally fails until the approval/data gates are satisfied. The CLI package is intentionally `private: true`. Deployment and publication workflows are manual and require explicit confirmation. Nothing deploys on a pull request or ordinary push.

## Development

Use Node **24.20.0 LTS** and npm (CI pins Node 24.20.0). Dependencies are exact-pinned in package.json and locked in package-lock.json.

```sh
npm ci
npm run build
npm run preview
```

Open http://127.0.0.1:5180. Use `/mk/` for Macedonian and `/?mode=dev` to open DEV. Mode switches reset section hashes and start at the introduction. DEV section commands do not update the URL; `lang en` / `lang mk` update only the `terminalLang` query parameter without navigating. `npm run dev` builds and serves; it is deliberately not a watcher. Rebuild after source/JSON changes. The preview server binds to loopback and serves only `dist`.

```sh
npm run validate:content
npm run typecheck
npm run lint
npm test
npm run build
npm run test:cli
npx playwright install chromium firefox webkit
npm run test:e2e
```

`npm run check` runs validation, type checking, lint, unit/content/CLI tests, both builds, and an isolated installed-package test. Browser tests are separate. On Linux CI, Playwright's `install --with-deps` installs browser prerequisites. Automated accessibility checks supplement, not replace, manual keyboard/screen-reader and owner visual review.

The schema validator and CLI snapshots are generated before tests/type checking. Its CommonJS helpers are bundled into standalone ESM and it has a generated TypeScript declaration, so no Ajv runtime package is shipped to browsers or CLI users.

With the preview server running in another terminal, `npm run audit:performance` audits English CV, Macedonian CV, and DEV using Lighthouse's mobile simulation. It writes local reports under ignored `.artifacts/` and checks the 95 performance target. Preview SEO scores intentionally reflect `noindex`/robots restrictions. Lab scores are not production field metrics; rerun after adding the actual portrait.

## Architecture

```text
content/common.json + content/en.json / content/mk.json
                    |
             validate and resolve
                    |
      static CV HTML + public JSON + CLI fallback
                            |             |
                       web terminal     npm CLI
                            \             /
                         shared commands
```

- `content/schema/`: strict authoring and version-1 public JSON contracts.
- `scripts/content.mjs`: validates sources, matches record IDs, resolves localized payloads, computes deterministic content digests, and enforces release gates.
- `src/core/`: bounded command parser, pure dispatcher, content verification, bounded fetch transport. No DOM, filesystem, process, or storage access.
- `src/site/templates/`: escaped HTML templates. CV content is present before JavaScript runs.
- `src/site/client/`: small initial mode enhancer and lazily loaded terminal. DOM output uses textContent, not arbitrary JSON HTML.
- `src/site/styles.css`: responsive editorial/terminal styles using system fonts, including Cyrillic fallback.
- `src/cli/`: one-shot/interactive adapter, online/offline content loader, text renderer.
- `packages/cli/`: standalone package assembly; the core is not separately published.
- `dist/`, `.generated/`, package dist, test outputs, and private asset-review outputs are generated/ignored. Do not hand-edit generated content.

Application copy, labels, errors, SEO metadata, and ASCII artwork are authored in JSON. The social-preview title, image path, dimensions, and image alt text are fixed presentation constants in `src/site/templates/page.js`; social descriptions use each locale's JSON headline. Commands, IDs, punctuation, and presentation logic are protocol/code. Existing records can be added/reordered by content edits. A new layout/interaction type still requires code.

## Editing content

1. Edit the primary hostname once in `content/common.json` under `domain` (hostname only, without a scheme, path, or trailing slash). Builds derive the HTTPS origin, canonical/social/sitemap URLs, terminal prompt, site label, and CLI content endpoint from it. External GitHub, LinkedIn, and project URLs remain explicit links. Edit other language-independent links, dates, identifiers, asset references, and record order in the same file.
2. Edit matching English/Macedonian text in `content/en.json` and `content/mk.json`. Keep section/item IDs identical across all three files. No arbitrary HTML/Markdown is accepted.
3. A repeatable record requires a common record (`id`, `tags`, `links`) and matching localized items (`id`, `title`, `subtitle`, `paragraphs`, `bullets`). Arrays determine item order; `sectionOrder` determines section order.
4. Selected experience is ordered editorially and does not display employment dates or job titles. No employment period is required for publication. The schema still accepts optional legacy `period` data and validates its consistency, but renderers omit it.
5. Store only the obfuscated display address in `profile.email`, for example `mtrajk [at] outlook.com`. The schema rejects raw addresses; contact output is plain text, never a mailto link or client-side reconstruction. GitHub/LinkedIn remain normal links. Obfuscation deters simple harvesting but is not a privacy guarantee. Employer/client labels must reflect the actual relationship.
6. Review both languages, run validation/tests/build, and inspect both presentations. `updatedAt` is maintained with the content review, not computed on every build.
7. Mark individual `approvals` true only after the owner approves the associated facts/assets. Flags are a checklist, not a substitute for editorial review. Remove all draft sentences from locale content before approving it.

No GitHub API is called by visitors. Repository metrics are currently omitted. If adding them, provide a dated, reviewed snapshot in common data and extend the explicit schema/presentation intentionally. Do not label unsupported tools or unavailable services as currently maintained.

English lives at `/`, Macedonian at `/mk/`; the route selects language. There is no automatic locale redirect. UI command tokens remain English. Mode precedence is valid query parameter, saved preference, then CV. Only mode is persisted; command history is session-only. Blocked storage or DEV loading errors keep the CV readable.

DEV is a full-screen terminal with a single scrollable output region. The input and help text stay in a separate, bordered bottom panel, including after `clear` and viewport resizing. Each entry into DEV starts a fresh session with a labeled installation simulation and percentage progress; it never downloads or installs an npm package. Input is disabled until the animation completes, switching to CV cancels it, and reduced-motion preferences skip the timed animation. The prompt then receives focus, including after commands and when clicking non-interactive terminal space; text selection, links, and keyboard focus navigation remain available. Each result scrolls to its emphasized command line rather than its end. The CV header, navigation, language links, and footer are hidden; the same CV/DEV controls move to a floating top-right position and return to the header in CV mode. There are no terminal shortcut or submit buttons. Enter executes the typed command; `lang en` / `lang mk` switches language. The web-only `cv` / `mtrajk cv` command returns to the top of the localized CV and appears in web help/completion, never in native CLI help/completion.

CV content is generated into static HTML and needs no blocking content loader. Its navigation uses `aria-current="location"` and an underline to track the visible section while scrolling.

Command completion follows common shell conventions: inline suggestions accepted with Right Arrow at the end of the input, Tab completion/cycling, Up/Down history, and Escape dismissal. Shift+Tab always navigates focus backwards; Escape followed by Tab leaves the input normally. Completion does not execute commands, replace selected/mid-line text, or intercept IME composition. The shared completion vocabulary also serves the native readline CLI.

Research references: [PowerShell tab completion and inline predictions](https://learn.microsoft.com/en-us/powershell/scripting/learn/shell/tab-completion?view=powershell-7.6) and [email address munging and its limitations](https://en.wikipedia.org/wiki/Address_munging). The UI uses deterministic command suggestions, not AI predictions. The keyboard-escape regression supplies a following text-input fixture to avoid headless browser-chrome and OS link-tabbing differences while verifying native focus movement; production does not override the browser's focus order.

## Public data and compatibility

Build output includes stable `/data/v1/en.json` and `/data/v1/mk.json` plus content-addressed snapshots referenced by HTML. CV and DEV therefore share the same build digest. A missing hashed snapshot may fall back to the stable URL only if its content version matches the page; otherwise the user gets a reload/retry message and the CV remains available.

The CLI fetches stable endpoints and receives compatible content changes without a package update. It validates schema, locale, size, safe links, and text; the website additionally checks its expected digest. Failed/invalid requests use the CLI's bundled snapshot with a dated stderr notice. A package update refreshes its offline snapshot. Keep schema v1 compatible with older CLI releases; a breaking change needs a new endpoint major and compatible package release.

Builds remove only obsolete, self-identifying generated locale snapshots from `dist/data/v1`, so older local builds cannot keep exposing a previously published contact address. Unknown files and source content are not removed. This cannot retract previously downloaded data or git history. The still-unpublished v1 contract now requires an obfuscated email string; rebuild older local preview CLI packages to use it.

The HTML must still be rebuilt after a JSON edit. Pushes run verification; public deployment currently requires the manually approved Pages workflow. Do not expect an edit to a source JSON alone to update already deployed static HTML.

## CLI

```sh
node packages/cli/dist/cli.js about --offline
node packages/cli/dist/cli.js experience --lang mk --json --offline
node packages/cli/dist/cli.js
```

Commands: `help`, `intro`, `about`, `experience`, `strengths`, `skills`, `how-i-work`, `projects`, `hobbies`, `contact`, `all`, `lang en`, `lang mk`, and interactive `clear`. Aliases: `whoami`, `work`, `github`. Web/REPL also accept the `mtrajk` prefix.

Flags: `--lang`, `--offline`, `--json`, `--no-color`, `--no-animation`, `--help`, `--version`. `NO_COLOR` disables color. `--json` emits only result data on stdout; diagnostics use stderr. Invalid usage exits 2; unavailable/corrupt content without a usable fallback exits 1. No-argument piped use prints intro/help and exits instead of hanging. TTY use starts a small readline prompt with history, completion, Ctrl+C, and Ctrl+D.

Narrative DEV answers reveal in small Unicode-safe chunks, completing within about 1.2 seconds. Web users can select **Show full answer**, press Escape, or press Enter with an empty prompt to skip; a new command completes the previous answer, while `clear` or leaving DEV cancels it. Reduced-motion preferences bypass the effect. Interactive CLI sessions use the same pacing: Escape skips, typing finishes the current answer before echoing input, and Ctrl+C cancels without exiting. Use `--no-animation` for instant interactive output. CLI one-shot commands, pipes, JSON, CI, and dumb terminals are always instant; help, errors, skills, `all`, and ASCII artwork are also instant in both interfaces.

Web terminal language changes preserve the transcript, history, and input focus. Like other commands, explicit `lang` commands scroll the terminal to their confirmation or error; restoring a terminal language from browser history preserves the reading position. Existing entries retain their language; instructions, accessible labels, and future answers use the selected language. The current CV page and pathname stay unchanged while in DEV. Returning with the CV button or `cv` command adopts the terminal's selected language: if it differs from the page locale, the matching `/` or `/mk/` CV page opens with `mode=cv`; if it is unchanged, CV is shown in place without navigation. `/?mode=dev&terminalLang=mk` and `/mk/?mode=dev&terminalLang=en` restore the terminal language on refresh; the query parameter is omitted when it matches the page locale. Both locale snapshots are version-pinned, cached, and prefetched in DEV. A failed switch leaves the current language usable; subsequent commands wait for a pending switch, and a newer language command takes precedence.

The npm name `mtrajk` is proposed, **not reserved or verified**. Confirm ownership before removing `private`. The same package runs under Node/npm and Bun; `bunx --bun` forces Bun rather than following the Node shebang. Do not advertise `npx mtrajk` as this project until the approved package is actually published.

To inspect/pack, run these in `packages/cli` after building:

```sh
npm pack --dry-run
npm pack
```

The allowlist contains only `dist/cli.js`, the package manifest, README, the existing Apache license, and third-party legal notices. No install scripts or runtime dependencies. Tests install a tarball outside this repository and exercise its executable/shim.

## Portrait and artwork

Do not upload or commit a private reference photo without approval. After generating and selecting the portrait, use a **local, approved** image as input:

```sh
npm run assets:portrait -- "C:/path/to/approved-image.png"
```

By default, the offline Sharp script writes a stripped/optimized WebP under ignored `.artifacts/portrait/`, without changing content or approvals. After owner approval, add `--apply` to write `assets/portrait/portrait.webp`, update the shared JSON image path, and mark portrait approval. Add `--move-source` only when explicitly relocating the supplied image: it preserves the original under `assets/portrait/source.<extension>` and refuses to overwrite an existing source. The current approved original is `assets/portrait/source.jpeg`; regenerate it with `npm run assets:portrait -- assets/portrait/source.jpeg --apply`. No image conversion runs in the browser or CLI. The site build copies only the referenced WebP, not the original source image.

The original MTRAJK wordmark is stored in common JSON and shared by web DEV and the CLI. The CV uses the image portrait, with the monogram as a fallback when no portrait is configured. The approved static 1200 × 630 JPEG social card lives at `assets/social/meto-trajkovski-social-card.jpg` (about 43 KiB) and is copied unchanged by the build. Both locales share the fixed title “Meto Trajkovski — Product-Minded Software Engineer & Technical Leader” and image; Open Graph and Twitter descriptions are generated from the localized `headline` in JSON, while the browser title and SEO description continue to use localized `meta` values. Rebuild and deploy after editing those values; social platforms may cache previews. Image dimensions, MIME type, alt text, site name, and alternate locale metadata are included. Preview crawling restrictions remain unchanged. Device favicons live in `assets/favicon/`: 16px/32px PNG browser icons, an ICO fallback, a 180px Apple touch icon, and 192px/512px Android icons referenced by `site.webmanifest`. The manifest provides the site name and home-screen icons in normal browser display mode; it does not provide offline support or add a service worker. The build explicitly copies only these seven public files, adds content-hash query parameters to linked icon/manifest URLs, and provides `/favicon.ico` for legacy clients. `assets/favicon/favicon designs/` is preserved as source design history and is never copied into `dist`. No third-party fonts or image requests are used.

## Performance and safety

Builds enforce <=10 KiB gzipped initial JS, <=40 KiB all web JS, <=30 KiB CSS, and <=256 KiB public JSON. Art is bounded and compact on mobile. Content is escaped for HTML, URLs are allowlisted, input is not evaluated, and terminal controls are rejected/stripped. No server-side contact form, automatic link opening, telemetry, or credential handling.

Automated browser coverage includes Chromium, Firefox, WebKit, mobile Chromium and mobile WebKit emulation, both locales, no-JS, command history, navigation, failures, snapshot skew, and axe accessibility checks. Responsive regressions cover 320–430 px phone widths, the 600 px stacking breakpoint, wider layouts, landscape rotation, and a short viewport representing reduced space with an on-screen keyboard. Strengths and How I Work stack on phones; the DEV prompt and its 16 px input stay on one row. Emulation does not replace real-device keyboard and safe-area review. CI defines Windows/macOS/Linux Node jobs and Bun compatibility. A workflow definition is not evidence that those hosted jobs have run; check Actions results after pushing.

## Release: manual owner approval required

1. Confirm all missing facts and publication permissions; remove preview wording from the actual copy and review Macedonian. Confirm the approved portrait/ASCII and email; set remaining approvals only after review. Employment dates and job titles are not required.
2. Run `npm run validate:release`, `npm run check`, and `npm run test:e2e`. Review visual design and keyboard/screen-reader use. Check public project links before launch.
3. Confirm ownership of `mtrajk.dev` in `content/common.json` before DNS changes. Select GitHub Actions in Pages settings and set `mtrajk.dev` as the custom domain. Custom Actions deployment does not need a repository CNAME file.
4. Inspect DNS. Preserve MX/TXT/SPF/DKIM/DMARC records. Set the `mtrajk.dev` apex ALIAS/ANAME to `mtrajk.github.io` or use GitHub's currently documented A records. Configure `www.mtrajk.dev` as a CNAME to `mtrajk.github.io`. Never use a wildcard DNS record. Enable HTTPS after certificate readiness.
5. Configure the `github-pages` environment with appropriate owner approvals. Manually run the Pages workflow on master with confirmation `DEPLOY`. It validates/tests before uploading only `dist`.
6. Verify root/Macedonian pages, HTTPS, www redirect, metadata, assets, 404, deep links, and both public locale endpoints. User-site custom domains also affect project sites: verify Virus Spreading and SlediPratki and their original github.io links/assets. Do not alter unrelated repositories without approval.
7. Confirm npm ownership, approved package name/version, npm 2FA, and trusted-publisher setup for `.github/workflows/publish-cli.yml`. A first publication may need owner-driven bootstrapping. Remove package `private` and use a non-preview version only with explicit approval. Configure the `npm-release` environment and required reviewers separately; YAML cannot create reviewer protection.
8. Manually run the CLI workflow with `PUBLISH`. It requires current public JSON digests to match before publication. It uses npm 11.19.1 with OIDC/provenance, not a committed token. Do not deploy/publish from pull-request code.
9. Smoke-test the approved exact package version with npx and Bun outside this repository. Record the version/content digest. Restore a known-good approved Pages build for rollback; never force-push or unpublish to hide a failed release.

Periodically review experience, dates, contact, project availability, dependencies, and optional metric snapshots. Blog, analytics, and a dedicated PDF feature remain out of scope.

## License

Existing Apache-2.0 license preserved. Reference-site layouts and third-party branding were not copied. Any future portrait/font assets need owner approval and appropriate usage rights.
