export const sectionIds = [
  "intro",
  "about",
  "experience",
  "strengths",
  "how-i-work",
  "projects",
  "hobbies",
  "contact",
];
export const commands = [
  "help",
  "intro",
  "about",
  "experience",
  "strengths",
  "skills",
  "how-i-work",
  "projects",
  "hobbies",
  "contact",
  "all",
  "lang",
  "clear",
];
export const aliases = new Map([
  ["whoami", "intro"],
  ["work", "how-i-work"],
  ["github", "projects"],
]);
export const locales = ["en", "mk"];
export const MAX_INPUT = 256;
export const MAX_CONTENT_BYTES = 262144;
export const interpolate = (message, values = {}) =>
  message.replace(/\{(\w+)\}/g, (token, key) => String(values[key] ?? token));
export const cleanText = (value) =>
  String(value).replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
export function safeUrl(value) {
  if (
    typeof value !== "string" ||
    /[\s\u0000-\u001f\u007f-\u009f]/u.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "mailto:" &&
          /^[^@]+@[^@]+\.[^@]+$/.test(url.pathname) &&
          !url.search))
    );
  } catch {
    return false;
  }
}
export function getCompletions(input) {
  if (
    typeof input !== "string" ||
    input.length > MAX_INPUT ||
    /[^a-zA-Z0-9 \t-]/.test(input) ||
    !input.trim()
  )
    return [];
  const leading = input.match(/^[ \t]*/)[0];
  const value = input.slice(leading.length);
  const prefix = value.match(/^mtrajk[ \t]+/i)?.[0] ?? "";
  const needle = value.slice(prefix.length).toLowerCase();
  const languagePrefix = needle.match(/^lang[ \t]+/)?.[0];
  const choices = languagePrefix
    ? locales.map((locale) => `${languagePrefix}${locale}`)
    : [
        ...commands.filter((command) => command !== "lang"),
        ...locales.map((locale) => `lang ${locale}`),
        ...aliases.keys(),
      ];
  const candidates = prefix
    ? choices
    : [...choices, ...choices.map((command) => `mtrajk ${command}`)];
  return candidates
    .filter((candidate) => candidate.startsWith(needle) && candidate !== needle)
    .map((candidate) => `${leading}${prefix}${candidate}`);
}

export const sectionForCommand = (command) =>
  command === "skills" ? "strengths" : command;
