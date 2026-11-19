/**
 * Error thrown by fetchJson when the API responds with a non-2xx status.
 * `message` carries the backend's `detail` when it sends one (FastAPI does).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extractDetail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  // FastAPI validation errors: [{ loc, msg, type }, ...]
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : null,
      )
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }
  return null;
}

type AccessTokenProvider = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;

/**
 * Registered by AuthProvider so API calls can attach the signed-in user's
 * Supabase access token without every caller knowing about auth.
 */
export function setAccessTokenProvider(provider: AccessTokenProvider | null) {
  accessTokenProvider = provider;
}

async function getAccessToken(): Promise<string | null> {
  if (!accessTokenProvider) return null;
  try {
    return await accessTokenProvider();
  } catch {
    return null;
  }
}

/**
 * Drop-in replacement for fetch() for calls to the Consensus backend:
 * adds `Authorization: Bearer <supabase access token>` when signed in.
 * Without a session it behaves exactly like fetch().
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) return fetch(input, init);

  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

/**
 * fetch() + JSON parsing that fails loudly on HTTP errors.
 *
 * Plain `await (await fetch(url)).json()` happily parses an error body like
 * `{ "detail": "..." }` and hands it to code expecting a success payload,
 * which then crashes on missing fields. This throws an ApiError instead.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await authFetch(input, init);

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      extractDetail(body) ?? `Request failed (${res.status} ${res.statusText || "error"})`,
    );
  }

  if (body === null) {
    throw new ApiError(res.status, "The server returned an empty or invalid response.");
  }

  return body as T;
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return "Could not reach the server. Check your connection and try again.";
  return fallback;
}
