const providers = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "reddit", label: "Reddit" },
  { id: "email", label: "Email" },
  { id: "facebook", label: "Facebook" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "viber", label: "Viber" },
];

export function getShareLinks(content) {
  const canonicalUrl = `${content.siteUrl}${content.locale === "en" ? "/" : "/mk/"}`;
  const encodedUrl = encodeURIComponent(canonicalUrl);
  const encodedTitle = encodeURIComponent(content.meta.title);
  const encodedMessage = encodeURIComponent(`${content.meta.title} ${canonicalUrl}`);
  const urls = new Map([
    ["linkedin", `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`],
    ["twitter", `https://x.com/intent/post?text=${encodedTitle}&url=${encodedUrl}`],
    ["reddit", `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`],
    ["email", `mailto:?subject=${encodedTitle}&body=${encodedUrl}`],
    ["facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`],
    ["whatsapp", `https://wa.me/?text=${encodedMessage}`],
    ["telegram", `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`],
    ["viber", `viber://forward?text=${encodedMessage}`],
  ]);
  return providers.map(({ id, label }) => ({
    id,
    label,
    icon: `/assets/share/${id}.svg`,
    url: urls.get(id),
  }));
}
