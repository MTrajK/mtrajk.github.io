import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Ajv } from "ajv";
import { assertContent } from "../src/core/content.js";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const readJson = async (path) =>
  JSON.parse(
    await readFile(new URL(path, new URL("../", import.meta.url)), "utf8"),
  );
export const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export async function validators() {
  const ajv = new Ajv({
    allErrors: true,
    code: { source: true, esm: true },
    ownProperties: true,
  });
  const schemas = Object.fromEntries(
    await Promise.all(
      ["public", "common", "locale"].map(async (name) => [
        name,
        await readJson(`content/schema/${name}.schema.json`),
      ]),
    ),
  );
  for (const schema of Object.values(schemas)) ajv.addSchema(schema);
  return {
    ajv,
    public: ajv.getSchema(schemas.public.$id),
    common: ajv.getSchema(schemas.common.$id),
    locale: ajv.getSchema(schemas.locale.$id),
  };
}
export function check(validate, data, label) {
  if (!validate(data))
    throw new Error(`${label}: ${JSON.stringify(validate.errors)}`);
}
export function resolveContent(common, locale) {
  if (
    new Set(locale.sections.map((s) => s.id)).size !==
    common.sectionOrder.length
  )
    throw new Error("Duplicate or missing section IDs");
  const localSections = new Map(
    locale.sections.map((section) => [section.id, section]),
  );
  const links = (values) =>
    values.map(({ labelKey, url }) => ({ label: locale.ui[labelKey], url }));
  const sections = common.sectionOrder.map((id) => {
    const section = localSections.get(id);
    if (!section) throw new Error(`Missing section: ${id}`);
    const records = common.records[id];
    const translated = new Map(section.items.map((item) => [item.id, item]));
    if (
      translated.size !== section.items.length ||
      translated.size !== records.length ||
      new Set(records.map((item) => item.id)).size !== records.length
    )
      throw new Error(`Mismatched IDs: ${id}`);
    const items = records.map((record) => {
      if (!translated.has(record.id))
        throw new Error(`Missing translation: ${record.id}`);
      return {
        ...translated.get(record.id),
        ...record,
        links: links(record.links),
      };
    });
    const sectionLinks = id === "contact" ? links(common.contactLinks) : [];
    const paragraphs =
      id === "contact"
        ? [...section.paragraphs, `${locale.ui.email}: ${common.profile.email}`]
        : section.paragraphs;
    return { ...section, paragraphs, items, links: sectionLinks };
  });
  const ui = Object.fromEntries(
    Object.entries(locale.ui).map(([key, value]) => [
      key,
      value.replaceAll("{domain}", common.domain),
    ]),
  );
  const payload = {
    schemaVersion: common.schemaVersion,
    locale: locale.locale,
    updatedAt: common.updatedAt,
    siteUrl: `https://${common.domain}`,
    profile: {
      ...common.profile,
      name: locale.name,
      headline: locale.headline,
      motto: locale.motto,
    },
    meta: locale.meta,
    ui,
    terminal: locale.terminal,
    navigation: locale.navigation,
    sections,
    artwork: common.artwork,
  };
  return { ...payload, contentVersion: digest(payload) };
}
export async function loadContents({
  release = false,
  common = undefined,
  translations = undefined,
} = {}) {
  const v = await validators();
  common ??= await readJson("content/common.json");
  translations ??= await Promise.all(
    ["en", "mk"].map((locale) => readJson(`content/${locale}.json`)),
  );
  check(v.common, common, "common");
  if (
    new Set(common.shareOptions.map((option) => option.id)).size !==
    common.shareOptions.length
  )
    throw new Error("Duplicate share option IDs");
  if (
    translations.length !== 2 ||
    translations[0].locale !== "en" ||
    translations[1].locale !== "mk"
  )
    throw new Error("Expected English and Macedonian locale files");
  if (release) {
    await readFile(
      new URL(`../${common.profile.portrait.slice(1)}`, import.meta.url),
    );
  }
  return translations.map((locale) => {
    check(v.locale, locale, locale.locale);
    const payload = resolveContent(common, locale);
    assertContent(payload, v.public, locale.locale);
    return payload;
  });
}
