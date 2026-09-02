<?php
// GET    /api/admin/responses — список всех отправленных анкет (admin и viewer).
// POST   /api/admin/responses — импорт анкет из ранее экспортированного JSON (только admin).
// DELETE /api/admin/responses — удаление анкет: всех либо выбранных по slug (только admin).
define('ANKETA_ENTRY', true);
require_once __DIR__ . '/lib/common.php';

api_bootstrap();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    api_require_auth(array('admin', 'viewer'));

    $files = store_list_dir(RESPONSES_SUBDIR);
    $results = array();
    foreach ($files as $f) {
        if (substr($f, -5) !== '.json') {
            continue;
        }
        $data = store_get_json(RESPONSES_SUBDIR . '/' . $f, null);
        if ($data !== null) {
            $results[] = $data;
        }
    }
    api_send_json($results, 200);
} elseif ($method === 'POST') {
    // Импорт анкет (восстановление из экспортированного ранее JSON-файла).
    api_require_auth(array('admin'));

    $body = api_read_json_body();
    if (!is_array($body) || !isset($body['responses']) || !is_array($body['responses'])) {
        api_send_error(400, 'Ожидается поле "responses" со списком анкет');
    }

    $imported = 0;
    $skipped = 0;
    $now = gmdate('Y-m-d\TH:i:s\Z');

    foreach ($body['responses'] as $item) {
        if (!is_array($item) || empty($item['telegram']) || empty($item['fio']) || empty($item['scores'])) {
            $skipped++;
            continue;
        }

        $telegram = api_normalize_telegram($item['telegram']);
        $slug = !empty($item['slug']) ? (string)$item['slug'] : api_slugify($telegram);
        if (!api_is_safe_slug($slug)) {
            $slug = api_slugify($telegram);
        }

        $item['telegram'] = $telegram;
        $item['slug'] = $slug;
        if (empty($item['submittedAt'])) {
            $item['submittedAt'] = $now;
        }
        $item['updatedAt'] = $now;
        if (!isset($item['version']) || !is_int($item['version'])) {
            $item['version'] = 1;
        }
        foreach (array('tools', 'practice', 'scores', 'background') as $objField) {
            if (isset($item[$objField])) {
                $item[$objField] = api_force_object_if_empty($item[$objField]);
            }
        }

        store_put_json(RESPONSES_SUBDIR . '/' . $slug . '.json', $item);
        $imported++;
    }

    api_send_json(array('ok' => true, 'imported' => $imported, 'skipped' => $skipped), 200);
} elseif ($method === 'DELETE') {
    api_require_auth(array('admin'));

    $body = api_read_json_body();
    if (!is_array($body)) {
        $body = array();
    }

    $deleted = 0;
    if (!empty($body['all'])) {
        $files = store_list_dir(RESPONSES_SUBDIR);
        foreach ($files as $f) {
            if (substr($f, -5) !== '.json') {
                continue;
            }
            if (store_delete_file(RESPONSES_SUBDIR . '/' . $f)) {
                $deleted++;
            }
        }
    } elseif (!empty($body['slugs']) && is_array($body['slugs'])) {
        foreach ($body['slugs'] as $slug) {
            $slug = (string)$slug;
            if (!api_is_safe_slug($slug)) {
                continue;
            }
            if (store_delete_file(RESPONSES_SUBDIR . '/' . $slug . '.json')) {
                $deleted++;
            }
        }
    } else {
        api_send_error(400, 'Укажите "all": true или список "slugs"');
    }

    api_send_json(array('ok' => true, 'deleted' => $deleted), 200);
} else {
    api_send_error(405, 'Метод не поддерживается');
}
