import validate from "../../.generated/validate.js";
import { assertContent, fetchContent } from "../core/content.js";
import { interpolate } from "../core/commands.js";

export function createContentLoader(
  snapshots,
  {
    offline = false,
    fetcher = globalThis.fetch,
    timeout = 2000,
    notice = (_message) => {},
  } = {},
) {
  const cache = new Map();
  return async (locale) => {
    if (cache.has(locale)) return cache.get(locale);
    let content;
    if (!offline) {
      try {
        content = await fetchContent(
          `https://mtrajk.me/data/v1/${locale}.json`,
          { locale, validate, fetcher, timeout },
        );
      } catch {}
    }
    if (!content) {
      content = assertContent(snapshots[locale], validate, locale);
      notice(
        interpolate(content.terminal.messages.fallback, {
          locale,
          date: content.updatedAt,
        }),
      );
    }
    cache.set(locale, content);
    return content;
  };
}
