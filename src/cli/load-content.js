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
    const snapshot = assertContent(snapshots[locale], validate, locale);
    let content;
    if (!offline) {
      try {
        content = await fetchContent(
          `${snapshot.siteUrl}/data/v1/${locale}.json`,
          { locale, validate, fetcher, timeout },
        );
      } catch {}
    }
    if (!content) {
      content = snapshot;
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
