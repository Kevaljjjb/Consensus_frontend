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

/**
 * fetch() + JSON parsing that fails loudly on HTTP errors.
 *
 * Plain `await (await fetch(url)).json()` happily parses an error body like
 * `{ "detail": "..." }` and hands it to code expecting a success payload,
 * which then crashes on missing fields. This throws an ApiError instead.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);

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
