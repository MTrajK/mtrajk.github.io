export interface Link {
  label: string;
  url: string;
}
export interface Period {
  start: string;
  end: string | null;
  current: boolean;
}
export interface Skill {
  title: string;
  values: string[];
}
export interface Item {
  id: string;
  title: string;
  subtitle: string;
  paragraphs: string[];
  bullets: string[];
  tags: string[];
  links: Link[];
  organization?: string;
  client?: string;
  period?: Period;
}
export interface Section {
  id: string;
  title: string;
  kicker: string;
  paragraphs: string[];
  items: Item[];
  links: Link[];
  skills?: Skill[];
}
export interface Content {
  schemaVersion: 1;
  contentVersion: string;
  locale: "en" | "mk";
  updatedAt: string;
  siteUrl: string;
  profile: {
    name: string;
    username: string;
    headline: string;
    motto: string;
    email: string;
    portrait: string;
  };
  meta: { title: string; description: string };
  ui: Record<string, string>;
  navigation: Record<string, string>;
  terminal: {
    messages: Record<string, string>;
    commandDescriptions: Record<string, string>;
  };
  artwork: {
    wordmark: string[];
    compact: string[];
    scene: string[];
  };
  sections: Section[];
}
export type Result =
  | { type: "error"; message: string }
  | { type: "clear" }
  | { type: "language"; locale: string }
  | {
      type: "help";
      title: string;
      hint: string;
      items: { command: string; description: string }[];
    }
  | { type: "skills"; title: string; groups: Skill[] }
  | { type: "sections"; command: string; sections: Section[] };
