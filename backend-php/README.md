# PHP backend (Beget hosting)

Лёгкий PHP-бэкенд для анкетирования магистрантов, хранящий данные в JSON-файлах
на диске. Заменяет прежний Cloudflare Worker — рассчитан на бюджетный
FTP-only хостинг (без SSH), совместим с PHP 5.6+.

## Структура

- `api/*.php` — эндпоинты (`lookup`, `submit`, `admin-login`, `admin-responses`, `admin-users`, `admin-user`)
- `api/lib/*.php` — общие библиотеки (конфиг, JWT, хранилище, общие функции)
- `.htaccess` — маршрутизация `/api/...` → соответствующие `.php`-файлы + SPA fallback на `index.html`

## Настройка перед деплоем

1. Скопируйте `api/lib/config.example.php` в `api/lib/config.php`.
2. Задайте свои значения:
   - `JWT_SECRET` — длинная случайная строка (например, `openssl rand -hex 32`)
   - `ADMIN_BOOTSTRAP_PASSWORD` — пароль администратора по умолчанию (логин `admin`)
   - `ALLOWED_ORIGIN` — адрес фронтенда
3. `config.php` в `.gitignore` — не коммитьте реальные секреты в публичный репозиторий.

## Хранение данных

`DATA_DIR` (по умолчанию — каталог `data/` рядом с `public_html/`, вне веб-корня)
должен существовать и быть доступен на запись веб-сервером. Внутри создаются:

- `data/responses/<slug>.json` — анкеты (по одному файлу на пользователя)
- `data/users.json` — учётные записи администраторов/просмотрщиков

## Локальный запуск для тестов

```bash
mkdir -p /tmp/test-root/data/responses
cp -r api /tmp/test-root/
cd /tmp/test-root && php -S localhost:8199
# эндпоинты доступны как /api/lookup.php, /api/submit.php и т.д.
# (встроенный сервер PHP не обрабатывает .htaccess-переписывание)
```
