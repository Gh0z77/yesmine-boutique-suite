import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { LANGS, type Lang } from "@/lib/i18n";

export const LANG_COOKIE = "yesmine.lang";

/** One year — the visitor's choice should outlast the session. */
const MAX_AGE = 60 * 60 * 24 * 365;

function parse(source: string | null | undefined): Lang | null {
  if (!source) return null;
  const match = new RegExp(`(?:^|;\\s*)${LANG_COOKIE.replace(".", "\\.")}=([^;]+)`).exec(source);
  const value = match?.[1];
  return LANGS.some((l) => l.code === value) ? (value as Lang) : null;
}

/**
 * Which language to render, known before the first byte is sent.
 *
 * The choice used to live only in localStorage, which the server cannot read.
 * So the server rendered English, the browser read "uz" a moment later and
 * re-rendered in Uzbek — React saw the page change underneath it mid-hydration
 * and threw the whole tree away, which is what error #418 was reporting. An
 * Uzbek visitor also watched the page flash English first.
 *
 * A cookie travels with the request, so the server renders the right language
 * straight away and the browser has nothing to correct.
 */
export const readLang = createIsomorphicFn()
  .server((): Lang => parse(getRequest()?.headers.get("cookie")) ?? "en")
  .client((): Lang => parse(document.cookie) ?? "en");

export function writeLangCookie(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}
