<?php
// POST /api/lookup — поиск ранее отправленной анкеты по имени пользователя Telegram и ФИО.
define('ANKETA_ENTRY', true);
require_once __DIR__ . '/lib/common.php';

api_bootstrap();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_error(405, 'Метод не поддерживается');
}

$body = api_read_json_body();
if (!is_array($body) || empty($body['telegram'])) {
    api_send_error(400, 'Не указано имя пользователя в Телеграм');
}

$telegram = api_normalize_telegram($body['telegram']);
$slug = api_slugify($telegram);
$path = RESPONSES_SUBDIR . '/' . $slug . '.json';

if (!store_file_exists($path)) {
    api_send_json(array('found' => false), 200);
}

$data = store_get_json($path, null);
if ($data === null) {
    api_send_json(array('found' => false), 200);
}

if (!empty($body['fio']) && api_normalize_fio($data['fio']) !== api_normalize_fio($body['fio'])) {
    api_send_error(403, 'Анкета с таким именем пользователя уже зарегистрирована на другое ФИО. Проверьте имя пользователя в Телеграм.');
}

api_send_json(array('found' => true, 'data' => $data), 200);
