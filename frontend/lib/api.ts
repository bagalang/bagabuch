// lib/api.ts — HTTP клиент към bagabuch backend-а (:8080) с JWT.

import { readStorage, writeStorage } from "./storage";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const TOKEN_KEY = "***";

export function getToken(): string | null {
  return readStorage(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  writeStorage(TOKEN_KEY, token);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail =
      (data as { detail?: string } | null)?.detail ??
      (typeof data === "string" ? data : res.statusText);
    throw new ApiError(res.status, String(detail));
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, "GET"),
  post: <T>(path: string, body?: unknown) => request<T>(path, "POST", body),
  put: <T>(path: string, body?: unknown) => request<T>(path, "PUT", body),
  patch: <T>(path: string, body?: unknown) => request<T>(path, "PATCH", body),
  del: <T>(path: string) => request<T>(path, "DELETE"),
};

export async function downloadFile(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    let detail = res.statusText;
    try {
      const data = JSON.parse(text) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      if (text) detail = text;
    }
    throw new ApiError(res.status, String(detail));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// автентикация
export async function login(username: string): Promise<string> {
  const data = await api.post<{ access_token: string }>("/v1/auth/token", {
    sub: username,
  });
  setToken(data.access_token);
  return data.access_token;
}

export function logout(): void {
  setToken(null);
}

// общ тип за списък
export interface ListResponse<T> {
  items: T[];
  count: number;
}

// фирма
export interface Company {
  id: number;
  name: string;
  eik: string;
  [key: string]: unknown;
}

// активна фирма (мултитенант)
// Събитие, на което хедърът слуша, за да обнови активната фирма.
export const ACTIVE_COMPANY_EVENT = "bagabuch-active-company-changed";

export function getActiveCompany(): Promise<Company | Record<string, never>> {
  return api.get<Company | Record<string, never>>("/v1/active-company");
}

export async function setActiveCompany(id: number): Promise<Company> {
  const data = await api.put<Company>("/v1/active-company", {
    company_id: id,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACTIVE_COMPANY_EVENT));
  }
  return data;
}
