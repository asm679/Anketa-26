<?php
// Конфигурация PHP-бэкенда анкетирования (хостинг Beget, PHP 5.6.40).
// Файл не должен быть доступен напрямую из веба — вызывается только через require_once.

if (!defined('ANKETA_ENTRY')) {
    http_response_code(403);
    exit;
}

// Секрет для подписи JWT-токенов администратора (HS256).
define('JWT_SECRET', 'CHANGE_ME_generate_a_long_random_hex_string');

// Пароль для bootstrap-входа суперадминистратора (логин: admin).
define('ADMIN_BOOTSTRAP_PASSWORD', 'CHANGE_ME');

// Разрешённый источник для CORS (фронтенд и бэкенд на одном домене, но заголовки
// выставляются на случай локальной разработки/предпросмотра).
define('ALLOWED_ORIGIN', 'http://z99392ok.beget.tech');

// Каталог для хранения данных — ВНЕ public_html, недоступен напрямую из веба.
// public_html и data — соседние каталоги внутри домашней папки домена.
define('DATA_DIR', dirname($_SERVER['DOCUMENT_ROOT']) . '/data');

define('RESPONSES_SUBDIR', 'responses');
define('USERS_FILE', 'users.json');
