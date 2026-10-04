import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { loadContents } from "../scripts/content.mjs";
import { createContentLoader } from "../src/cli/load-content.js";
import { runCli, parseArgs } from "../src/cli/main.js";
import { renderText, renderBanner } from "../src/cli/render-result.js";
import { executeCommand } from "../src/core/execute-command.js";

const snapshots = Object.fromEntries(
  (await loadContents()).map((content) => [content.locale, content]),
);
function capture(onWrite = () => {}) {
  let stdout = "",
    stderr = "";
  const output = new Writable({
    write(chunk, _encoding, callback) {
      stdout += chunk.toString();
      onWrite(stdout, chunk.toString());
      callback();
    },
  });
  const error = new Writable({
    write(chunk, _encoding, callback) {
      stderr += chunk.toString();
      callback();
    },
  });
  return {
    output,
    error,
    input: new PassThrough(),
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

test(
  "interactive readline handles mid-line cancellation, commands, locale changes, and Ctrl+D",
  { timeout: 5000 },
  async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    Object.assign(input, { isTTY: true, setRawMode: () => {} });
    Object.assign(output, { isTTY: true, columns: 60 });
    let transcript = "",
      step = 0;
    const prompts = [
      snapshots.en.ui.commandPrompt,
      snapshots.en.terminal.messages.cancelled,
      snapshots.en.sections.find((s) => s.id === "about").title,
      snapshots.mk.terminal.messages.languageChanged.replace("{locale}", "mk"),
      snapshots.mk.ui.skills,
    ];
    const inputs = [
      "invalid\u001b[D\u0003",
      "about\n",
      "lang mk\n",
      "skills\n",
      "\u0004",
    ];
    output.on("data", (chunk) => {
      transcript += chunk.toString();
      if (step < prompts.length && transcript.includes(prompts[step])) {
        const next = inputs[step++];
        setImmediate(() => input.write(next));
      }
    });
    const diagnostics = capture();
    assert.equal(
      await runCli(["--offline"], {
        snapshots,
        version: "0.1.0",
        input,
        output,
        error: diagnostics.error,
        env: { NO_COLOR: "" },
      }),
      0,
    );
    assert.equal(step, 5);
    assert.ok(transcript.includes(snapshots.mk.terminal.messages.goodbye));
    input.destroy();
    output.destroy();
  },
);

for (const locale of ["en", "mk"]) {
  test(`interactive ${locale} answers stream, skip, and finish before new input`, { timeout: 5000 }, async () => {
    const content = snapshots[locale];
    const partial = [];
    let step = 0;
    const io = capture((text, chunk) => {
      if ((step === 0 || step === 2) && chunk.startsWith("\x1b[36m")) {
        partial.push(chunk);
        const first = step === 0;
        step++;
        setImmediate(() => first
          ? io.input.write("\x1b")
          : io.input.write("help\n"));
      } else if (step === 1 && text.includes(content.ui.commandPrompt)) {
        step = 2;
        setImmediate(() => io.input.write("about\n"));
      } else if (step === 3 && text.includes(executeCommand("help", content).title)) {
        step = 4;
        setImmediate(() => io.input.write("\u0004"));
      }
    });
    Object.assign(io.input, { isTTY: true, setRawMode: () => {} });
    Object.assign(io.output, { isTTY: true, columns: 60 });
    assert.equal(await runCli(["--offline", "--lang", locale], {
      ...io, snapshots, version: "0.1.0", env: {},
    }), 0);
    assert.equal(step, 4);
    for (const [index, command] of ["intro", "about"].entries()) {
      const full = renderText(executeCommand(command, content), content, { width: 60, color: true });
      assert.ok(partial[index].length < full.length);
      assert.ok(io.stdout.includes(full));
    }
    assert.ok(io.stdout.includes(content.terminal.messages.goodbye));
    assert.equal(io.input.listenerCount("keypress"), 0);
    io.input.destroy();
    io.output.destroy();
  });
}

test("Ctrl+C cancels a streaming answer without closing the CLI", { timeout: 5000 }, async () => {
  let step = 0;
  const io = capture((text, chunk) => {
    if (step === 0 && chunk.startsWith("\x1b[36m")) {
      step = 1;
      setImmediate(() => io.input.write("\u0003"));
    } else if (step === 1 && text.includes(snapshots.en.terminal.messages.cancelled)) {
      step = 2;
      setImmediate(() => io.input.write("help\n"));
    } else if (step === 2 && text.includes(executeCommand("help", snapshots.en).title)) {
      step = 3;
      setImmediate(() => io.input.write("\u0004"));
    }
  });
  Object.assign(io.input, { isTTY: true, setRawMode: () => {} });
  Object.assign(io.output, { isTTY: true, columns: 60 });
  assert.equal(await runCli(["--offline"], { ...io, snapshots, version: "0.1.0", env: {} }), 0);
  assert.equal(step, 3);
  assert.ok(io.stdout.includes("\x1b[0m\n"));
  assert.ok(!io.stdout.includes(snapshots.en.profile.motto));
  assert.ok(io.stdout.includes(snapshots.en.terminal.messages.goodbye));
  assert.equal(io.input.listenerCount("keypress"), 0);
  io.input.destroy();
  io.output.destroy();
});

test("closing the terminal cancels reveal timers and removes input listeners", { timeout: 5000 }, async () => {
  let closing = false;
  const io = capture((_text, chunk) => {
    if (!closing && chunk.startsWith("\x1b[36m")) {
      closing = true;
      setImmediate(() => io.input.write("\u0004"));
    }
  });
  Object.assign(io.input, { isTTY: true, setRawMode: () => {} });
  Object.assign(io.output, { isTTY: true, columns: 60 });
  assert.equal(await runCli(["--offline"], { ...io, snapshots, version: "0.1.0", env: {} }), 0);
  const completed = io.stdout;
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(io.stdout, completed);
  assert.ok(completed.includes(snapshots.en.terminal.messages.goodbye));
  assert.equal(io.input.listenerCount("keypress"), 0);
  io.input.destroy();
  io.output.destroy();
});

test("animation opt-out, CI, and dumb terminals print interactive answers instantly", { timeout: 5000 }, async () => {
  for (const [args, env] of [
    [["--offline", "--no-animation"], { NO_COLOR: "" }],
    [["--offline"], { NO_COLOR: "", CI: "1" }],
    [["--offline"], { TERM: "dumb" }],
  ]) {
    const writes = [];
    let closed = false;
    const io = capture((text, chunk) => {
      writes.push(chunk);
      if (!closed && text.includes(snapshots.en.ui.commandPrompt)) {
        closed = true;
        setImmediate(() => io.input.write("\u0004"));
      }
    });
    Object.assign(io.input, { isTTY: true, setRawMode: () => {} });
    Object.assign(io.output, { isTTY: true, columns: 60 });
    assert.equal(await runCli(args, { ...io, snapshots, version: "0.1.0", env }), 0);
    assert.ok(writes.includes(renderText(executeCommand("intro", snapshots.en), snapshots.en, { width: 60 })));
    assert.ok(!io.stdout.includes(snapshots.en.terminal.messages.revealHint));
    io.input.destroy();
    io.output.destroy();
  }
});

test("one-shot TTY commands remain instant", async () => {
  const writes = [];
  const io = capture((_text, chunk) => writes.push(chunk));
  Object.assign(io.input, { isTTY: true, setRawMode: () => {} });
  Object.assign(io.output, { isTTY: true, columns: 60 });
  assert.equal(await runCli(["about", "--offline"], {
    ...io, snapshots, version: "0.1.0", env: { NO_COLOR: "" },
  }), 0);
  assert.deepEqual(writes, [renderText(executeCommand("about", snapshots.en), snapshots.en, { width: 60 })]);
});

test("corrupt offline snapshots fail clearly without leaking stack traces", async () => {
  const io = capture();
  const corrupted = { ...snapshots, en: { ...snapshots.en, schemaVersion: 2 } };
  assert.equal(
    await runCli(["about", "--offline"], {
      ...io,
      snapshots: corrupted,
      version: "0.1.0",
    }),
    1,
  );
  assert.equal(io.stderr.trim(), snapshots.en.terminal.messages.fatal);
  assert.equal(io.stdout, "");
});

test("CLI flags reject unsupported and ambiguous input", () => {
  assert.equal(parseArgs(["about", "--lang", "mk"]).locale, "mk");
  assert.equal(parseArgs(["--no-animation"]).error, false);
  assert.equal(parseArgs(["--no-animation"]).noAnimation, true);
  for (const args of [
    ["--lang"],
    ["--lang", "fr"],
    ["--unknown"],
    ["about contact"],
    ["x".repeat(257)],
  ])
    assert.equal(parseArgs(args).error, true);
});

test("one-shot JSON is clean, localized, and matches the shared engine", async () => {
  for (const locale of ["en", "mk"]) {
    const io = capture();
    assert.equal(
      await runCli(["experience", "--lang", locale, "--offline", "--json"], {
        ...io,
        snapshots,
        version: "0.1.0",
      }),
      0,
    );
    assert.deepEqual(
      JSON.parse(io.stdout),
      executeCommand("experience", snapshots[locale]),
    );
    assert.equal(
      io.stderr.includes(snapshots[locale].terminal.messages.preview),
      snapshots[locale].preview,
    );
    assert.equal(io.stdout.includes("\x1b"), false);
  }
});

test("help/version do not fetch and one-shot failures have meaningful exit codes", async () => {
  const fetcher = () => {
    throw new Error("Must not fetch");
  };
  for (const args of [["--help"], ["--version"], ["help"]]) {
    const io = capture();
    assert.equal(
      await runCli(args, { ...io, snapshots, version: "0.1.0", fetcher }),
      0,
    );
    assert.equal(io.stderr, "");
    assert.ok(io.stdout);
  }
  for (const args of [["--invalid"], ["clear"], ["unknown"]]) {
    const io = capture();
    assert.equal(
      await runCli(args, { ...io, snapshots, version: "0.1.0", fetcher }),
      2,
    );
  }
});

test("non-TTY no-argument invocation does not wait for stdin", async () => {
  const io = capture();
  assert.equal(
    await runCli(["--offline"], { ...io, snapshots, version: "0.1.0" }),
    0,
  );
  assert.ok(io.stdout.includes("Meto Trajkovski"));
  assert.ok(io.stdout.includes("mtrajk help"));
  assert.equal(io.stdout.includes(snapshots.en.artwork.wordmark[0]), false);
});

test("online content updates are consumed once per process without a package update", async () => {
  let calls = 0;
  const fresh = structuredClone(snapshots.en);
  fresh.sections[1].paragraphs[0] = "New public content";
  const loader = createContentLoader(snapshots, {
    fetcher: async () => {
      calls++;
      return new Response(JSON.stringify(fresh));
    },
  });
  assert.equal(
    (await loader("en")).sections[1].paragraphs[0],
    "New public content",
  );
  await loader("en");
  assert.equal(calls, 1);
});

test("offline, timeouts, invalid responses, and wrong locale fall back safely", async () => {
  for (const fetcher of [
    async () => {
      throw new Error("DNS failed");
    },
    async () => new Response("not JSON"),
    async () => new Response("{}", { status: 500 }),
    async () =>
      new Response(JSON.stringify({ ...snapshots.en, schemaVersion: 2 })),
    async () => new Response(JSON.stringify(snapshots.mk)),
    async () => new Response("x".repeat(262145)),
    async (_url, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("timeout"))),
      ),
  ]) {
    const notices = [];
    const loader = createContentLoader(snapshots, {
      fetcher,
      timeout: 5,
      notice: (message) => notices.push(message),
    });
    assert.deepEqual(await loader("en"), snapshots.en);
    assert.equal(notices.length, 1);
  }
  const loader = createContentLoader({ en: {} }, { offline: true });
  await assert.rejects(loader("en"));
});

test("plain output wraps narrow terminals and never forwards data control sequences", () => {
  const result = {
    type: "error",
    message: "\x1b]0;unsafe\x07" + "abcdefgh ".repeat(12),
  };
  const output = renderText(result, snapshots.en, { width: 24 });
  assert.equal(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/.test(output), false);
  assert.ok(
    output
      .trim()
      .split("\n")
      .every((line) => line.length <= 24),
  );
  assert.ok(renderBanner(snapshots.en, 24).includes("[ M T R A J K ]"));
});
