// Вспомогательные функции авторизации админ-панели: чтение роли/логина из JWT без верификации подписи
// (подпись проверяется на стороне Worker при каждом запросе — здесь только для UI).

export interface JwtPayload {
  sub: string;
  role: 'admin' | 'viewer';
  exp?: number;
  iat?: number;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJwt(token);
  if (!payload) return false;
  if (payload.exp && Date.now() / 1000 > payload.exp) return false;
  return true;
}
