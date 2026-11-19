const AUTH_PATHS = ["/login", "/signup"];

/**
 * Turn an untrusted redirect target (e.g. the `?redirect=` query param or a
 * value read from localStorage) into a same-origin path that is safe to pass
 * to `router.replace`.
 *
 * Anything that would leave the site — absolute URLs, protocol-relative
 * `//host` URLs, `/\host` (which browsers normalise to `//host`),
 * `javascript:` URLs — falls back to `fallback`. Redirects back to the auth
 * pages are also rejected to avoid login loops.
 */
export function getSafeRedirect(
  target: string | null | undefined,
  origin: string,
  fallback = "/",
): string {
  if (!target) return fallback;

  const value = target.trim();

  // Must be a root-relative path. Rejects "https://…", "javascript:…", "evil.com".
  if (!value.startsWith("/")) return fallback;

  // Reject protocol-relative forms: "//evil.com", "/\evil.com".
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;

  // Reject control characters (tabs/newlines are stripped by URL parsers and
  // can turn "/\t/evil.com" into "//evil.com").
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return fallback;
  }

  if (url.origin !== new URL(origin).origin) return fallback;

  if (
    AUTH_PATHS.some(
      (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
    )
  ) {
    return fallback;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
