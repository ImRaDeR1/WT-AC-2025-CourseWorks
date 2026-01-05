export type ApiOk<T> = { status: "ok"; data: T };
export type ApiError = {
  status: "error";
  error: { code: string; message: string; fields?: Record<string, string> };
};

export type ApiResponse<T> = ApiOk<T> | ApiError;

export class ApiClientError extends Error {
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

const getBaseUrl = () => {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  return (fromEnv ?? "http://localhost:3001").replace(/\/$/, "");
};

const buildHeaders = (token?: string) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export const apiFetch = async <T>(
  path: string,
  options?: { method?: string; token?: string; body?: unknown }
): Promise<T> => {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: buildHeaders(options?.token),
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();

  if (!text) {
    if (res.ok) return undefined as unknown as T;
    throw new ApiClientError("bad_response", "Empty response");
  }

  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new ApiClientError("bad_response", "Invalid JSON response");
  }

  if (json.status === "ok") {
    return json.data;
  }

  throw new ApiClientError(json.error.code, json.error.message, json.error.fields);
};
