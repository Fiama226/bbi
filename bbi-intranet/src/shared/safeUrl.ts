const DEFAULT_BASE = "https://sharepoint.invalid/";

const baseUrl = (): string =>
  typeof window !== "undefined" && window.location && window.location.href
    ? window.location.href
    : DEFAULT_BASE;

const hasControlCharacters = (value: string): boolean =>
  value.split("").some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x20 || code === 0x7f;
  });

/** Normalize a user- or list-supplied link and reject executable/unknown schemes. */
export const safeHref = (value?: string): string | undefined => {
  const clean = (value || "").trim();
  if (!clean || hasControlCharacters(clean)) {
    return undefined;
  }
  if (clean.charAt(0) === "#") {
    return clean;
  }

  try {
    const resolved = new URL(clean, baseUrl());
    if (resolved.protocol === "https:" || resolved.protocol === "http:") {
      return resolved.href;
    }
    if (resolved.protocol === "mailto:" || resolved.protocol === "tel:") {
      return resolved.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

/** Image URLs never accept data:, javascript:, blob:, or other active schemes. */
export const safeImageUrl = (value?: string): string | undefined => {
  const clean = (value || "").trim();
  if (!clean || hasControlCharacters(clean)) {
    return undefined;
  }

  try {
    const resolved = new URL(clean, baseUrl());
    const pageProtocol =
      typeof window !== "undefined" && window.location
        ? window.location.protocol
        : "https:";
    if (
      (resolved.protocol === "https:" ||
        (resolved.protocol === "http:" && pageProtocol === "http:")) &&
      !resolved.username &&
      !resolved.password
    ) {
      return resolved.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
};
