<?php
// GET /api/admin/responses — список всех отправленных анкет (для admin и viewer).
define('ANKETA_ENTRY', true);
require_once __DIR__ . '/lib/common.php';

api_bootstrap();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_send_error(405, 'Метод не поддерживается');
}

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
