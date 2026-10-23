import { MAX_CONTENT_BYTES, safeUrl, sectionIds } from "./commands.js";

export function assertContent(content, validate, locale, version = undefined) {
  if (!validate(content)) throw new Error("Invalid content schema");
  if (
    content.locale !== locale ||
    (version && content.contentVersion !== version)
  )
    throw new Error("Content snapshot mismatch");
  if (
    new TextEncoder().encode(JSON.stringify(content)).length > MAX_CONTENT_BYTES
  )
    throw new Error("Content too large");
  const ids = content.sections.map((section) => section.id);
  if (
    new Set(ids).size !== sectionIds.length ||
    sectionIds.some((id) => !ids.includes(id))
  )
    throw new Error("Invalid section IDs");
  if (!content.sections.find((s) => s.id === "strengths").skills?.length)
    throw new Error("Missing skills");
  if (
    new Date(content.updatedAt).toISOString().slice(0, 10) !== content.updatedAt
  )
    throw new Error("Invalid review date");
  for (const section of content.sections) {
    if (
      new Set(section.items.map((item) => item.id)).size !==
      section.items.length
    )
      throw new Error("Duplicate item IDs");
    for (const link of [
      ...section.links,
      ...section.items.flatMap((item) => item.links),
    ])
      if (!safeUrl(link.url)) throw new Error("Unsafe URL");
    if (
      section.id === "contact" &&
      section.links.some((link) => link.url.startsWith("mailto:"))
    )
      throw new Error("Contact links must not contain mailto URLs");
    for (const item of section.items) {
      if (
        item.period &&
        (item.period.current !== (item.period.end === null) ||
          (item.period.end && item.period.end < item.period.start))
      )
        throw new Error("Invalid employment period");
    }
  }
  if (content.profile.portrait.split("/").includes(".."))
    throw new Error("Unsafe portrait path");
  return content;
}

export async function fetchContent(
  url,
  {
    locale,
    validate,
    version = undefined,
    fetcher = globalThis.fetch,
    timeout = 2000,
  },
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      redirect: "error",
      credentials: "omit",
    });
    if (
      !response.ok ||
      (response.url && new URL(response.url).origin !== new URL(url).origin)
    )
      throw new Error("Content unavailable");
    if (Number(response.headers.get("content-length")) > MAX_CONTENT_BYTES)
      throw new Error("Content too large");
    if (!response.body) throw new Error("Missing response body");
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_CONTENT_BYTES) {
          await reader.cancel();
          throw new Error("Content too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return assertContent(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      validate,
      locale,
      version,
    );
  } finally {
    clearTimeout(timer);
  }
}
