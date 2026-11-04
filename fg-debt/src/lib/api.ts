import { API_URL } from "@/lib/api-url";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token =
    options.token !== undefined
      ? options.token
      : typeof window !== "undefined"
        ? localStorage.getItem("fg_debt_token")
        : null;

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    code?: string;
    data?: T;
  };

  if (!response.ok || json.success === false) {
    throw new ApiError(json.message || "Request failed.", response.status, json.code);
  }

  return json.data as T;
}
