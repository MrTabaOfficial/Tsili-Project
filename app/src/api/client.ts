import { apiErrorSchema } from "@tsili/shared";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** Supplies the bearer token and knows how to get a new one when the server says 401. */
export interface TokenProvider {
  getAccessToken(): Promise<string | null>;
  refresh(): Promise<string | null>;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  tokens?: TokenProvider;
  baseUrl?: string;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const first = await send<T>(path, opts, await opts.tokens?.getAccessToken());
  if (first.kind === "ok") return first.value;
  if (first.error.status === 401 && opts.tokens) {
    const fresh = await opts.tokens.refresh();
    if (fresh) {
      const second = await send<T>(path, opts, fresh);
      if (second.kind === "ok") return second.value;
      throw second.error;
    }
  }
  throw first.error;
}

type Outcome<T> = { kind: "ok"; value: T } | { kind: "error"; error: ApiRequestError };

async function send<T>(path: string, opts: RequestOptions, accessToken: string | null | undefined): Promise<Outcome<T>> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const init: RequestInit = { method: opts.method ?? (opts.body === undefined ? "GET" : "POST"), headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl ?? API_URL}${path}`, init);
  } catch (err) {
    return { kind: "error", error: new ApiRequestError(0, "NETWORK", err instanceof Error ? err.message : "network error") };
  }
  if (res.status === 204) return { kind: "ok", value: undefined as T };
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.ok) return { kind: "ok", value: json as T };
  const parsed = apiErrorSchema.safeParse(json);
  const error = parsed.success
    ? new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.issues)
    : new ApiRequestError(res.status, "HTTP_ERROR", `request failed with status ${res.status}`);
  return { kind: "error", error };
}
