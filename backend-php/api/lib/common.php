<?php
// Общие вспомогательные функции API: CORS, JSON-ответы, нормализация, валидация, авторизация.

if (!defined('ANKETA_ENTRY')) {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/store.php';
require_once __DIR__ . '/jwt.php';

function api_slugify($value) {
    $value = trim((string)$value);
    if (function_exists('mb_strtolower')) {
        $value = mb_strtolower($value, 'UTF-8');
    } else {
        $value = strtolower($value);
    }
    $value = preg_replace('/[^a-z0-9а-яё_\-]/iu', '-', $value);
    $value = preg_replace('/-+/', '-', $value);
    $value = trim($value, '-');
    if ($value === '') {
        $value = 'unknown';
    }
    if (function_exists('mb_substr')) {
        $value = mb_substr($value, 0, 60, 'UTF-8');
    } else {
        $value = substr($value, 0, 60);
    }
    return $value;
}

// Проверяет, что slug состоит только из безопасных символов и не может выйти за пределы
// каталога анкет — защита от path traversal при админ-удалении/импорте по slug из запроса.
function api_is_safe_slug($slug) {
    return is_string($slug) && $slug !== '' && preg_match('/^[a-z0-9\x{0430}-\x{044f}\x{0451}_-]+$/iu', $slug) === 1;
}

// PHP кодирует пустой ассоциативный массив array() как JSON-массив "[]", а не
// объект "{}" — приводим к stdClass, чтобы поля вида Record<string, boolean>
// всегда сериализовались как объект, даже если пусты (совместимость с фронтендом).
function api_force_object_if_empty($value) {
    if (is_array($value) && count($value) === 0) {
        return new stdClass();
    }
    return $value;
}

function api_normalize_fio($fio) {
    $fio = trim((string)$fio);
    if (function_exists('mb_strtolower')) {
        $fio = mb_strtolower($fio, 'UTF-8');
    } else {
        $fio = strtolower($fio);
    }
    $fio = preg_replace('/\s+/u', ' ', $fio);
    return $fio;
}

// Приводит имя пользователя Telegram к чистому виду "nick_name": убирает ведущие "@"
// и ссылочные префиксы вида t.me/, telegram.me/.
function api_normalize_telegram($value) {
    $value = trim((string)$value);
    $value = preg_replace('#^https?://(t(elegram)?\.me|telegram\.org)/#i', '', $value);
    $value = ltrim($value, '@');
    $value = trim($value);
    return $value;
}

function api_cors_headers() {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    $allowed = ($origin !== '') && (
        $origin === ALLOWED_ORIGIN ||
        strpos($origin, 'http://localhost') === 0 ||
        strpos($origin, 'http://127.0.0.1') === 0
    );
    header('Access-Control-Allow-Origin: ' . ($allowed ? $origin : ALLOWED_ORIGIN));
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Vary: Origin');
}

function api_send_json($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function api_send_error($status, $message) {
    api_send_json(array('error' => $message), $status);
}

function api_read_json_body() {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return null;
    }
    $data = json_decode($raw, true);
    return $data;
}

// Вызывать в начале каждого api/*.php: выставляет CORS-заголовки и завершает
// preflight-запросы OPTIONS.
function api_bootstrap() {
    api_cors_headers();
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function api_get_bearer_token() {
    $header = '';
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $k => $v) {
            if (strtolower($k) === 'authorization') {
                $header = $v;
                break;
            }
        }
    }
    if ($header === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['HTTP_AUTHORIZATION'];
    }
    if ($header === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (strpos($header, 'Bearer ') === 0) {
        return substr($header, 7);
    }
    return null;
}

// Проверяет JWT из заголовка Authorization. При ошибке сразу отправляет ответ
// об ошибке и завершает выполнение. $roles — список допустимых ролей или null.
function api_require_auth($roles = null) {
    $token = api_get_bearer_token();
    if (!$token) {
        api_send_error(401, 'Требуется авторизация');
    }
    try {
        $payload = jwt_verify($token, JWT_SECRET);
    } catch (Exception $e) {
        api_send_error(401, 'Сессия недействительна, войдите снова');
    }
    if ($roles !== null && !in_array($payload['role'], $roles, true)) {
        api_send_error(403, 'Недостаточно прав');
    }
    return $payload;
}

// Валидация анкеты при отправке. Возвращает null, если всё в порядке, иначе
// текст ошибки для показа пользователю.
function api_validate_submission($body) {
    if (!is_array($body)) {
        return 'Пустое тело запроса';
    }
    if (empty($body['telegram']) || trim((string)$body['telegram']) === '') {
        return 'Не указано имя пользователя в Телеграм';
    }
    if (empty($body['fio']) || trim((string)$body['fio']) === '') {
        return 'Не указано ФИО';
    }
    if (!isset($body['consent152fz']) || $body['consent152fz'] !== true) {
        return 'Не получено согласие на обработку персональных данных (152-ФЗ)';
    }
    if (!isset($body['scores']) || !is_array($body['scores'])) {
        return 'Отсутствуют ответы анкеты (scores)';
    }
    $scoreValues = array_values($body['scores']);
    if (count($scoreValues) < 70) {
        return 'Анкета заполнена не полностью';
    }
    foreach ($scoreValues as $v) {
        if (!is_int($v) || $v < 0 || $v > 5) {
            return 'Некорректное значение оценки (допустимо 0-5)';
        }
    }
    if (isset($body['motivation']) && (!is_int($body['motivation']) || $body['motivation'] < 1 || $body['motivation'] > 5)) {
        return 'Некорректное значение мотивации (допустимо 1-5)';
    }
    if (isset($body['desiredBlocks']) && !is_array($body['desiredBlocks'])) {
        return 'Некорректный формат желаемых блоков';
    }
    return null;
}
