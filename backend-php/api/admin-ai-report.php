<?php
// GET  /api/admin/ai-report — последний сохранённый отчёт ИИ-анализа (admin и viewer).
// POST /api/admin/ai-report — сохранить новый отчёт ИИ-анализа (только admin).
//
// Хранится только текст ответа модели и метаданные (провайдер, модель, дата,
// число анкет на момент генерации). Сам API-ключ пользователя никогда не
// попадает на сервер — вызов к провайдеру ИИ выполняется напрямую из браузера.
define('ANKETA_ENTRY', true);
require_once __DIR__ . '/lib/common.php';

api_bootstrap();

$method = $_SERVER['REQUEST_METHOD'];
$AI_REPORT_FILE = 'ai-report.json';

if ($method === 'GET') {
    api_require_auth(array('admin', 'viewer'));
    $report = store_get_json($AI_REPORT_FILE, null);
    api_send_json($report, 200);
} elseif ($method === 'POST') {
    api_require_auth(array('admin'));
    $body = api_read_json_body();
    if (!is_array($body) || empty($body['reportText']) || !is_string($body['reportText'])) {
        api_send_error(400, 'Укажите reportText');
    }

    $provider = isset($body['provider']) && is_string($body['provider']) ? $body['provider'] : 'unknown';
    $model = isset($body['model']) && is_string($body['model']) ? $body['model'] : 'unknown';
    $totalResponses = isset($body['totalResponses']) ? (int)$body['totalResponses'] : 0;

    $record = array(
        'reportText' => $body['reportText'],
        'provider' => $provider,
        'model' => $model,
        'totalResponses' => $totalResponses,
        'generatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
    );

    store_put_json($AI_REPORT_FILE, $record);
    api_send_json($record, 200);
} else {
    api_send_error(405, 'Метод не поддерживается');
}
