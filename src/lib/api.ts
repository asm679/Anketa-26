// Клиент к PHP-бэкенду на Beget (public_html/api/*.php). Бэкенд развёрнут на том же
// домене, что и фронтенд, поэтому VITE_API_BASE пустой и запросы идут по относительным
// путям /api/... (см. .env.production).
import type { AdminUser, SurveyResponse } from './types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) {
    throw new ApiError(res.status, body?.error || `Ошибка запроса (${res.status})`);
  }
  return body as T;
}

export { ApiError };

// ---- Респондент ----

export async function lookupResponse(
  telegram: string,
  fio: string
): Promise<{ found: boolean; data?: SurveyResponse }> {
  return request('/api/lookup', {
    method: 'POST',
    body: JSON.stringify({ telegram, fio }),
  });
}

export async function submitResponse(
  payload: Omit<SurveyResponse, 'slug' | 'submittedAt' | 'updatedAt' | 'version'>
): Promise<{ ok: true; updatedAt: string }> {
  return request('/api/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---- Админ ----

const TOKEN_KEY = 'anketa26_admin_token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminLogin(
  username: string,
  password: string
): Promise<{ token: string; role: 'admin' | 'viewer'; username: string }> {
  return request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchAllResponses(): Promise<SurveyResponse[]> {
  return request('/api/admin/responses', { headers: authHeaders() });
}

export async function fetchUsers(): Promise<AdminUser[]> {
  return request('/api/admin/users', { headers: authHeaders() });
}

export async function createUser(
  username: string,
  password: string,
  role: 'admin' | 'viewer'
): Promise<AdminUser> {
  return request('/api/admin/users', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username, password, role }),
  });
}

export async function updateUser(
  id: string,
  patch: { username?: string; password?: string; role?: 'admin' | 'viewer' }
): Promise<AdminUser> {
  return request(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
}

export async function deleteUser(id: string): Promise<{ ok: true }> {
  return request(`/api/admin/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}
