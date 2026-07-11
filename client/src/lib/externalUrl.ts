export function getSafeExternalUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function openExternalUrl(value?: string | null): boolean {
  const url = getSafeExternalUrl(value);
  if (!url) return false;

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
