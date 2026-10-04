import test from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../src/core/parse-command.js";
import { executeCommand } from "../src/core/execute-command.js";
import {
  commands,
  cleanText,
  safeUrl,
  getCompletions,
} from "../src/core/commands.js";
import { loadContents } from "../scripts/content.mjs";
import { createReveal, revealUnits } from "../src/core/reveal.js";

test("reveal units preserve graphemes, Macedonian, and complete ANSI colors", () => {
  assert.deepEqual(revealUnits("\x1b[36me\u0301\u{1d11e}\nМ\x1b[0m"), [
    "\x1b[36m", "e\u0301", "\u{1d11e}", "\n", "М", "\x1b[0m",
  ]);
});

test("progressive reveal is bounded, skippable, and cancellable", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const positions = [];
  let completed = 0;
  const first = createReveal(1000, position => positions.push(position), () => completed++);
  assert.deepEqual(positions, []);
  context.mock.timers.tick(24);
  assert.deepEqual(positions, [20]);
  first.finish();
  assert.equal(positions.at(-1), 1000);
  first.finish();
  context.mock.timers.tick(1200);
  assert.equal(completed, 1);
  const cancelled = createReveal(1000, position => positions.push(position), () => completed++);
  cancelled.cancel();
  cancelled.finish();
  context.mock.timers.tick(1200);
  assert.equal(positions.length, 2);
  assert.equal(completed, 1);
  createReveal(100000, position => positions.push(position), () => completed++);
  for (let tick = 0; tick < 50; tick++) context.mock.timers.tick(24);
  assert.equal(positions.at(-1), 100000);
  assert.equal(completed, 2);
});

test("completion offers only executable commands, aliases, and locale arguments", () => {
  assert.deepEqual(getCompletions("mtrajk a"), ["mtrajk about", "mtrajk all"]);
  assert.deepEqual(getCompletions("exp"), ["experience"]);
  assert.deepEqual(getCompletions("MTRAJK   exp"), ["MTRAJK   experience"]);
  assert.deepEqual(getCompletions("lang m"), ["lang mk"]);
  assert.deepEqual(getCompletions("mtrajk lang e"), ["mtrajk lang en"]);
  assert.deepEqual(getCompletions("who"), ["whoami"]);
  for (const input of [
    "",
    "   ",
    "about",
    "unknown",
    "about;",
    "x".repeat(257),
    "about\n",
  ])
    assert.deepEqual(getCompletions(input), []);
  for (const input of ["m", "a", "mtrajk ", "lang ", "work", "G"])
    for (const candidate of getCompletions(input))
      assert.ok(!parseCommand(candidate).error);
});

test("CV mode switching is a web-only command, not a native CLI command", async () => {
  assert.equal(parseCommand("cv").error, "unknown");
  assert.ok(!getCompletions("c").includes("cv"));
  assert.ok(getCompletions("c", ["cv"]).includes("cv"));
  for (const content of await loadContents()) {
    assert.equal(executeCommand("cv", content).type, "error");
    assert.ok(!executeCommand("help", content).items.some(item => item.command === "cv"));
  }
});

test("small command grammar rejects shell syntax, prototype names, and excessive input", () => {
  for (const value of [
    "about; echo hi",
    "about | cat",
    "about\ncontact",
    "a".repeat(257),
    "\x1b]0;bad\x07",
    "about extra",
  ])
    assert.equal(parseCommand(value).error, "invalid");
  assert.equal(parseCommand("constructor").error, "unknown");
  assert.equal(parseCommand("__proto__").error, "invalid");
  assert.equal(parseCommand("mtrajk lang xx").error, "language");
  assert.equal(parseCommand(" MTRAJK  ABOUT ").command, "about");
  assert.equal(parseCommand("whoami").command, "intro");
  assert.equal(parseCommand("work").command, "how-i-work");
  assert.equal(parseCommand("github").command, "projects");
  assert.equal(parseCommand("").command, "help");
});

test("every command selects shared localized data without mutating it", async () => {
  for (const content of await loadContents()) {
    const before = JSON.stringify(content);
    for (const command of commands) {
      const result = executeCommand(
        command === "lang" ? "lang mk" : command,
        content,
      );
      assert.notEqual(result.type, "error");
      if (result.type === "sections") assert.ok(result.sections.length);
    }
    assert.deepEqual(executeCommand("all", content).sections, content.sections);
    assert.deepEqual(
      executeCommand("skills", content).groups,
      content.sections.find((s) => s.id === "strengths").skills,
    );
    assert.equal(
      executeCommand("invalid", content).message,
      content.terminal.messages.unknown.replace("{command}", "invalid"),
    );
    assert.equal(JSON.stringify(content), before);
  }
});

test("safe links and terminal text cannot introduce active protocols or controls", () => {
  assert.equal(safeUrl("https://github.com/MTrajK"), true);
  assert.equal(safeUrl("mailto:meto@example.com"), true);
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://a:b@example.com",
    "mailto:x@y.me?body=bad",
    "https://example.com/\n",
  ])
    assert.equal(safeUrl(url), false);
  assert.equal(cleanText("\x1b[31mHello\x07\nМето"), "[31mHello\nМето");
});
