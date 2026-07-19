// Обёртка над GitHub Contents API для чтения/записи файлов в приватном репозитории данных.

const API_ROOT = 'https://api.github.com';

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function utf8ToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

export function base64ToUtf8(b64) {
  return new TextDecoder().decode(base64ToBytes(b64));
}

export class GitHubStore {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  headers(extra = {}) {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'anketa26-worker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra,
    };
  }

  // Возвращает {content, sha} или null, если файл не существует.
  async getFile(path) {
    const res = await fetch(
      `${API_ROOT}/repos/${this.owner}/${this.repo}/contents/${path}`,
      { headers: this.headers() }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return { content: base64ToUtf8(json.content), sha: json.sha };
  }

  // Список файлов в директории. Возвращает [] если директория не существует.
  async listDir(path) {
    const res = await fetch(
      `${API_ROOT}/repos/${this.owner}/${this.repo}/contents/${path}`,
      { headers: this.headers() }
    );
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub LIST ${path} failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  }

  // Создаёт или обновляет файл. sha нужен только при обновлении существующего файла.
  async putFile(path, contentStr, message, sha) {
    const res = await fetch(
      `${API_ROOT}/repos/${this.owner}/${this.repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          message,
          content: utf8ToBase64(contentStr),
          ...(sha ? { sha } : {}),
        }),
      }
    );
    if (!res.ok) throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async deleteFile(path, message, sha) {
    const res = await fetch(
      `${API_ROOT}/repos/${this.owner}/${this.repo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message, sha }),
      }
    );
    if (!res.ok) throw new Error(`GitHub DELETE ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async getJson(path, fallback) {
    const file = await this.getFile(path);
    if (!file) return { data: fallback, sha: null };
    return { data: JSON.parse(file.content), sha: file.sha };
  }

  async putJson(path, data, message, sha) {
    return this.putFile(path, JSON.stringify(data, null, 2), message, sha);
  }
}
