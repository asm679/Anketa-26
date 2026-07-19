# Anketa-26 API (Cloudflare Worker)

Лёгкий прокси-сервис, который безопасно хранит секреты (токен доступа к приватному
репозиторию данных, ключ подписи сессий) и предоставляет API для сайта на GitHub Pages.
Сам сайт остаётся статичным и лежит в GitHub Pages — Worker только обслуживает запись/чтение данных.

## Разовая настройка (сделать один раз)

### 1. Аккаунт Cloudflare

Если аккаунта нет — зарегистрируйтесь бесплатно на [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
Бесплатного тарифа (100 000 запросов/сутки) более чем достаточно для анкетирования.

### 2. Fine-grained токен GitHub для доступа к данным

1. Откройте [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. Repository access → **Only select repositories** → `asm679/Anketa-26-data`
3. Permissions → Repository permissions → **Contents: Read and write**
4. Создайте токен и сохраните его — это значение для секрета `GH_DATA_TOKEN`

### 3. Установка Wrangler и авторизация

```bash
cd worker
npm install
npx wrangler login
```

### 4. Секреты Worker

```bash
npx wrangler secret put GH_DATA_TOKEN
# вставьте токен из шага 2

npx wrangler secret put JWT_SECRET
# вставьте любую длинную случайную строку, например: openssl rand -hex 32

npx wrangler secret put ADMIN_BOOTSTRAP_PASSWORD
# вставьте пароль для первого входа в админ-панель (логин: admin)
```

### 5. Первый деплой

```bash
npx wrangler deploy
```

Wrangler выведет адрес вида `https://anketa26-api.<ваш-субдомен>.workers.dev` —
этот адрес нужно указать в `.env.production` фронтенда (`VITE_API_BASE`) и пересобрать сайт.

## Автоматический деплой из GitHub Actions

После разового шага 2–4 выше добавьте в **Settings → Secrets and variables → Actions**
репозитория `Anketa-26` секрет `CLOUDFLARE_API_TOKEN` (создаётся в Cloudflare Dashboard →
My Profile → API Tokens → "Edit Cloudflare Workers" шаблон). Дальше воркер будет
автоматически передеплоиваться при каждом push в папку `worker/` (см. `.github/workflows/deploy-worker.yml`).

## Локальная разработка

```bash
cd worker
npx wrangler dev
```

Появится локальный адрес (обычно `http://127.0.0.1:8787`) — укажите его в
`.env.local` фронтенда как `VITE_API_BASE`.
