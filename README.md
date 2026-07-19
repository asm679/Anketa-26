# Анкетирование поступающих — Искусственный интеллект

Веб-приложение для входного анкетирования поступающих в магистратуру по направлению
«Искусственный интеллект». Полностью в экосистеме GitHub: сайт — GitHub Pages,
данные — приватный GitHub-репозиторий, деплой — GitHub Actions.

- **Сайт (анкета + админ-панель):** https://asm679.github.io/Anketa-26/
- **Хранилище данных:** [asm679/Anketa-26-data](https://github.com/asm679/Anketa-26-data) (приватный репозиторий)
- **API-прокси:** Cloudflare Worker, код в [`worker/`](worker/)

## Зачем нужен прокси-сервис

GitHub Pages отдаёт только статичные файлы — там нет серверного кода. Чтобы анонимный
абитуриент мог сохранить анкету, а данные при этом не были видны всем в интернете (в
анкетах есть ФИО и номер билета — персональные данные по 152-ФЗ), используется один
маленький бесплатный сервис (Cloudflare Worker), который держит секретный токен и
проверяет права доступа перед каждой записью/чтением. Сам сайт и вся логика построены
вокруг GitHub — Worker — это единственный элемент вне GitHub, и он делает систему
безопасной, а не просто «для вида в экосистеме GitHub».

## Структура репозитория

```
src/            — React-приложение (анкета + админ-панель)
content → src/content/taxonomy.json — 80 тем анкетирования (9 блоков A–I)
worker/         — Cloudflare Worker (API-прокси к приватному репозиторию данных)
.github/workflows/deploy-pages.yml   — деплой сайта на GitHub Pages
.github/workflows/deploy-worker.yml  — деплой Worker на Cloudflare
```

## Разовая настройка (нужно сделать один раз)

1. **Настроить Worker** — подробная инструкция в [`worker/README.md`](worker/README.md):
   создать аккаунт Cloudflare, fine-grained GitHub-токен для `Anketa-26-data`, задать секреты
   `GH_DATA_TOKEN`, `JWT_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`, выполнить `wrangler deploy`.
2. **Указать адрес Worker сайту** — после первого деплоя Worker скопируйте его адрес
   (`https://anketa26-api.<субдомен>.workers.dev`) и обновите переменную репозитория
   `API_BASE_URL`: Settings → Secrets and variables → Actions → Variables.
3. **Автодеплой Worker из Actions (опционально)** — добавьте секрет `CLOUDFLARE_API_TOKEN`
   в Settings → Secrets and variables → Actions → Secrets, тогда Worker будет обновляться
   автоматически при каждом push в `worker/`.
4. **Пересобрать сайт** — после обновления `API_BASE_URL` запустите workflow
   «Deploy frontend to GitHub Pages» вручную (Actions → Deploy frontend → Run workflow)
   или сделайте любой push — сайт подхватит новый адрес API.

## Вход в админ-панель

Первый вход: логин `admin`, пароль — тот, что задан в секрете `ADMIN_BOOTSTRAP_PASSWORD`
Worker. После входа создайте именные учётные записи в разделе «Пользователи» (роли:
`admin` — полный доступ, `viewer` — только просмотр статистики и отчётов).

## Уникальность анкеты

Ключ анкеты — номер экзаменационного билета. При повторной отправке с тем же билетом и
тем же ФИО анкета обновляется (режим редактирования); билет, привязанный к другому ФИО,
защищён от перезаписи.

## Локальная разработка

```bash
npm install
cp .env.example .env.local   # укажите адрес локального или развёрнутого Worker
npm run dev
```

Для локального Worker: `cd worker && npx wrangler dev`.
