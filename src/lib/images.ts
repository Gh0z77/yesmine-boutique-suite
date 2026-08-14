/**
 * Ask image hosts for the size we actually display.
 *
 * The seed catalogue points at Unsplash, which resizes on the fly from query
 * parameters. A product card 300px wide was downloading the 1000px original —
 * 210 KB instead of 41 KB, twelve times over on the shop page.
 *
 * Photos the owner uploads are the bigger problem: a picture straight off a
 * phone is around 3 MB, and it was being sent whole to a 300px card. Supabase
 * can resize those too, through a different URL — measured on this project,
 * one 3,228,177-byte PNG comes back as 22,176 bytes of WebP at 450px wide.
 * Anything from a host we can't resize is returned untouched.
 */

const UNSPLASH_HOSTS = ["images.unsplash.com", "plus.unsplash.com"];

/** Supabase serves originals here… */
const STORAGE_PATH = "/storage/v1/object/public/";
/** …and resized copies here. */
const RENDER_PATH = "/storage/v1/render/image/public/";

/** Widths we offer the browser; it picks by viewport and pixel density. */
export const CARD_WIDTHS = [300, 450, 600, 900] as const;
export const HERO_WIDTHS = [600, 900, 1200, 1600] as const;
export const THUMB_WIDTHS = [80, 160, 240] as const;

type Kind = "unsplash" | "supabase" | null;

function classify(url: string): { parsed: URL; kind: Kind } | null {
  try {
    const parsed = new URL(url);
    if (UNSPLASH_HOSTS.includes(parsed.hostname)) return { parsed, kind: "unsplash" };
    if (parsed.hostname.endsWith(".supabase.co") && parsed.pathname.startsWith(STORAGE_PATH))
      return { parsed, kind: "supabase" };
    return null;
  } catch {
    return null;
  }
}

export function imageSrc(url: string | null | undefined, width: number, quality = 70): string {
  if (!url) return "";
  const match = classify(url);
  if (!match) return url;

  const { parsed, kind } = match;

  if (kind === "unsplash") {
    parsed.searchParams.set("w", String(width));
    parsed.searchParams.set("q", String(quality));
    // auto=format hands back WebP/AVIF to browsers that accept it.
    parsed.searchParams.set("auto", "format");
    parsed.searchParams.set("fit", "crop");
    return parsed.toString();
  }

  // Supabase resizes from a parallel path rather than query parameters on the
  // original, and picks WebP by itself from the browser's Accept header.
  const resized = new URL(parsed.toString());
  resized.pathname = parsed.pathname.replace(STORAGE_PATH, RENDER_PATH);
  resized.searchParams.set("width", String(width));
  resized.searchParams.set("quality", String(quality));
  resized.searchParams.set("resize", "contain");
  return resized.toString();
}

/** Empty string when the host can't resize — React then ignores the attribute. */
export function imageSrcSet(
  url: string | null | undefined,
  widths: readonly number[],
  quality = 70,
): string {
  if (!url || !classify(url)) return "";
  return widths.map((w) => `${imageSrc(url, w, quality)} ${w}w`).join(", ");
}
