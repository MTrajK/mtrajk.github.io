import shareOptions from "../../.generated/share-options.js";

export function getShareLinks(content) {
  const canonicalUrl = `${content.siteUrl}${content.locale === "en" ? "/" : "/mk/"}`;
  const values = new Map([
    ["url", canonicalUrl],
    ["title", content.meta.title],
    ["message", `${content.meta.title} ${canonicalUrl}`],
  ]);
  return shareOptions.map(({ id, label, icon, url }) => {
    const resolvedUrl = url.replace(/\{([^{}]+)\}/g, (_, key) => {
      const value = values.get(key);
      if (value === undefined)
        throw new Error(`Unknown share URL placeholder: ${key}`);
      return encodeURIComponent(value);
    });
    if (/[{}]/.test(resolvedUrl))
      throw new Error(`Invalid share URL template for ${id}`);
    return { id, label, icon, url: resolvedUrl };
  });
}
