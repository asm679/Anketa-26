import { GitHubStore } from './github.js';
import { signJwt, verifyJwt, hashPassword, randomSalt, randomId } from './jwt.js';

const RESPONSES_DIR = 'responses';
const USERS_FILE = 'users.json';

function slugifyTicket(ticket) {
  return (
    String(ticket)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё_-]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'unknown'
  );
}

function normalizeFio(fio) {
  return String(fio || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (origin === env.ALLOWED_ORIGIN) return true;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  return false;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = isAllowedOrigin(origin, env);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function error(status, message, extraHeaders) {
  return json({ error: message }, status, extraHeaders);
}

function store(env) {
  return new GitHubStore(env.GH_DATA_TOKEN, env.DATA_REPO_OWNER, env.DATA_REPO_NAME);
}

// ---- Валидация анкеты ----

function validateSubmission(body) {
  if (!body || typeof body !== 'object') return 'Пустое тело запроса';
  if (!body.ticket || !String(body.ticket).trim()) return 'Не указан номер экзаменационного билета';
  if (!body.fio || !String(body.fio).trim()) return 'Не указано ФИО';
  if (body.consent152fz !== true) return 'Не получено согласие на обработку персональных данных (152-ФЗ)';
  if (!body.scores || typeof body.scores !== 'object') return 'Отсутствуют ответы анкеты (scores)';
  const scoreValues = Object.values(body.scores);
  if (scoreValues.length < 70) return 'Анкета заполнена не полностью';
  for (const v of scoreValues) {
    if (!Number.isInteger(v) || v < 0 || v > 4) return 'Некорректное значение оценки (допустимо 0-4)';
  }
  if (body.motivation !== undefined && (!Number.isInteger(body.motivation) || body.motivation < 1 || body.motivation > 5)) {
    return 'Некорректное значение мотивации (допустимо 1-5)';
  }
  return null;
}

// ---- Респондент: lookup ----

async function handleLookup(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.ticket) return error(400, 'Не указан номер билета');
  const slug = slugifyTicket(body.ticket);
  const file = await store(env).getFile(`${RESPONSES_DIR}/${slug}.json`);
  if (!file) return json({ found: false }, 200);
  const data = JSON.parse(file.content);
  if (body.fio && normalizeFio(data.fio) !== normalizeFio(body.fio)) {
    return error(403, 'Билет уже зарегистрирован на другое ФИО. Проверьте номер билета.');
  }
  return json({ found: true, data }, 200);
}

// ---- Респондент: submit (upsert) ----

async function handleSubmit(request, env) {
  const body = await request.json().catch(() => null);
  const validationError = validateSubmission(body);
  if (validationError) return error(400, validationError);

  const slug = slugifyTicket(body.ticket);
  const path = `${RESPONSES_DIR}/${slug}.json`;
  const gh = store(env);
  const existing = await gh.getFile(path);
  const now = new Date().toISOString();

  if (existing) {
    const prev = JSON.parse(existing.content);
    if (normalizeFio(prev.fio) !== normalizeFio(body.fio)) {
      return error(403, 'Билет уже зарегистрирован на другое ФИО. Редактирование недоступно.');
    }
    const updated = {
      ...prev,
      ...body,
      slug,
      submittedAt: prev.submittedAt || now,
      updatedAt: now,
      version: (prev.version || 1) + 1,
    };
    await gh.putJson(path, updated, `Обновление анкеты: билет ${slug}`, existing.sha);
    return json({ ok: true, updatedAt: now, edited: true }, 200);
  } else {
    const created = { ...body, slug, submittedAt: now, updatedAt: now, version: 1 };
    await gh.putJson(path, created, `Новая анкета: билет ${slug}`, null);
    return json({ ok: true, updatedAt: now, edited: false }, 201);
  }
}

// ---- Админ: login ----

async function handleAdminLogin(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.password) return error(400, 'Не указан пароль');
  const username = (body.username || 'admin').trim();
  const password = body.password;

  // Bootstrap-вход суперадминистратора
  if (username === 'admin' && env.ADMIN_BOOTSTRAP_PASSWORD && password === env.ADMIN_BOOTSTRAP_PASSWORD) {
    const token = await signJwt({ sub: 'admin', role: 'admin' }, env.JWT_SECRET);
    return json({ token, role: 'admin', username: 'admin' }, 200);
  }

  const { data: users } = await store(env).getJson(USERS_FILE, []);
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return error(401, 'Неверный логин или пароль');
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return error(401, 'Неверный логин или пароль');

  const token = await signJwt({ sub: user.username, role: user.role }, env.JWT_SECRET);
  return json({ token, role: user.role, username: user.username }, 200);
}

// ---- Проверка авторизации админа ----

async function requireAuth(request, env, roles) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { error: error(401, 'Требуется авторизация') };
  try {
    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (roles && !roles.includes(payload.role)) {
      return { error: error(403, 'Недостаточно прав') };
    }
    return { payload };
  } catch (e) {
    return { error: error(401, 'Сессия недействительна, войдите снова') };
  }
}

// ---- Админ: получить все анкеты ----

async function handleAdminResponses(request, env) {
  const auth = await requireAuth(request, env, ['admin', 'viewer']);
  if (auth.error) return auth.error;
  const gh = store(env);
  const files = await gh.listDir(RESPONSES_DIR);
  const jsonFiles = files.filter((f) => f.name.endsWith('.json'));
  const results = await Promise.all(
    jsonFiles.map(async (f) => {
      const file = await gh.getFile(`${RESPONSES_DIR}/${f.name}`);
      if (!file) return null;
      try {
        return JSON.parse(file.content);
      } catch {
        return null;
      }
    })
  );
  return json(results.filter(Boolean), 200);
}

// ---- Админ: пользователи CRUD ----

async function handleUsersList(request, env) {
  const auth = await requireAuth(request, env, ['admin']);
  if (auth.error) return auth.error;
  const { data: users } = await store(env).getJson(USERS_FILE, []);
  return json(
    users.map(({ passwordHash, salt, ...rest }) => rest),
    200
  );
}

async function handleUsersCreate(request, env) {
  const auth = await requireAuth(request, env, ['admin']);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  if (!body || !body.username || !body.password || !body.role) {
    return error(400, 'Укажите username, password и role');
  }
  if (!['admin', 'viewer'].includes(body.role)) return error(400, 'Недопустимая роль');

  const gh = store(env);
  const { data: users, sha } = await gh.getJson(USERS_FILE, []);
  if (users.some((u) => u.username.toLowerCase() === body.username.toLowerCase())) {
    return error(409, 'Пользователь с таким именем уже существует');
  }
  const salt = randomSalt();
  const passwordHash = await hashPassword(body.password, salt);
  const now = new Date().toISOString();
  const newUser = {
    id: randomId(),
    username: body.username,
    salt,
    passwordHash,
    role: body.role,
    createdAt: now,
    updatedAt: now,
  };
  users.push(newUser);
  await gh.putJson(USERS_FILE, users, `Создан пользователь ${body.username}`, sha);
  const { passwordHash: _p, salt: _s, ...safe } = newUser;
  return json(safe, 201);
}

async function handleUsersUpdate(request, env, id) {
  const auth = await requireAuth(request, env, ['admin']);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const gh = store(env);
  const { data: users, sha } = await gh.getJson(USERS_FILE, []);
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return error(404, 'Пользователь не найден');

  const user = users[idx];
  if (body.username) user.username = body.username;
  if (body.role) {
    if (!['admin', 'viewer'].includes(body.role)) return error(400, 'Недопустимая роль');
    user.role = body.role;
  }
  if (body.password) {
    user.salt = randomSalt();
    user.passwordHash = await hashPassword(body.password, user.salt);
  }
  user.updatedAt = new Date().toISOString();
  users[idx] = user;
  await gh.putJson(USERS_FILE, users, `Изменён пользователь ${user.username}`, sha);
  const { passwordHash: _p, salt: _s, ...safe } = user;
  return json(safe, 200);
}

async function handleUsersDelete(request, env, id) {
  const auth = await requireAuth(request, env, ['admin']);
  if (auth.error) return auth.error;
  const gh = store(env);
  const { data: users, sha } = await gh.getJson(USERS_FILE, []);
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) return error(404, 'Пользователь не найден');
  await gh.putJson(USERS_FILE, filtered, `Удалён пользователь ${id}`, sha);
  return json({ ok: true }, 200);
}

// ---- Роутер ----

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      let response;
      if (pathname === '/api/lookup' && request.method === 'POST') {
        response = await handleLookup(request, env);
      } else if (pathname === '/api/submit' && request.method === 'POST') {
        response = await handleSubmit(request, env);
      } else if (pathname === '/api/admin/login' && request.method === 'POST') {
        response = await handleAdminLogin(request, env);
      } else if (pathname === '/api/admin/responses' && request.method === 'GET') {
        response = await handleAdminResponses(request, env);
      } else if (pathname === '/api/admin/users' && request.method === 'GET') {
        response = await handleUsersList(request, env);
      } else if (pathname === '/api/admin/users' && request.method === 'POST') {
        response = await handleUsersCreate(request, env);
      } else if (pathname.match(/^\/api\/admin\/users\/[^/]+$/) && request.method === 'PUT') {
        response = await handleUsersUpdate(request, env, pathname.split('/').pop());
      } else if (pathname.match(/^\/api\/admin\/users\/[^/]+$/) && request.method === 'DELETE') {
        response = await handleUsersDelete(request, env, pathname.split('/').pop());
      } else {
        response = error(404, 'Не найдено');
      }

      const merged = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) merged.set(k, v);
      return new Response(response.body, { status: response.status, headers: merged });
    } catch (e) {
      const resp = error(500, `Внутренняя ошибка сервера: ${e.message}`);
      const merged = new Headers(resp.headers);
      for (const [k, v] of Object.entries(cors)) merged.set(k, v);
      return new Response(resp.body, { status: resp.status, headers: merged });
    }
  },
};
