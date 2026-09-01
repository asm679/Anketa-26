<?php
// POST /api/submit — создание или обновление (upsert) анкеты по имени пользователя Telegram.
define('ANKETA_ENTRY', true);
require_once __DIR__ . '/lib/common.php';

api_bootstrap();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_error(405, 'Метод не поддерживается');
}

$body = api_read_json_body();
$validationError = api_validate_submission($body);
if ($validationError !== null) {
    api_send_error(400, $validationError);
}

$telegram = api_normalize_telegram($body['telegram']);
$slug = api_slugify($telegram);
$path = RESPONSES_SUBDIR . '/' . $slug . '.json';
$now = gmdate('Y-m-d\TH:i:s\Z');

foreach (array('tools', 'practice', 'scores', 'background') as $objField) {
    if (isset($body[$objField])) {
        $body[$objField] = api_force_object_if_empty($body[$objField]);
    }
}

$existing = store_get_json($path, null);

if ($existing !== null) {
    if (api_normalize_fio($existing['fio']) !== api_normalize_fio($body['fio'])) {
        api_send_error(403, 'Это имя пользователя в Телеграм уже зарегистрировано на другое ФИО. Редактирование недоступно.');
    }
    $updated = array_merge($existing, $body);
    $updated['telegram'] = $telegram;
    $updated['slug'] = $slug;
    $updated['submittedAt'] = isset($existing['submittedAt']) ? $existing['submittedAt'] : $now;
    $updated['updatedAt'] = $now;
    $updated['version'] = (isset($existing['version']) ? (int)$existing['version'] : 1) + 1;
    store_put_json($path, $updated);
    api_send_json(array('ok' => true, 'updatedAt' => $now, 'edited' => true), 200);
} else {
    $created = $body;
    $created['telegram'] = $telegram;
    $created['slug'] = $slug;
    $created['submittedAt'] = $now;
    $created['updatedAt'] = $now;
    $created['version'] = 1;
    store_put_json($path, $created);
    api_send_json(array('ok' => true, 'updatedAt' => $now, 'edited' => false), 201);
}
