<?php
// POST /api/admin/login — вход администратора/наблюдателя, выдача JWT-токена.
define('ANKETA_ENTRY', true);
require_once __DIR__ . '/lib/common.php';

api_bootstrap();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_error(405, 'Метод не поддерживается');
}

$body = api_read_json_body();
if (!is_array($body) || empty($body['password'])) {
    api_send_error(400, 'Не указан пароль');
}

$username = isset($body['username']) && trim((string)$body['username']) !== '' ? trim((string)$body['username']) : 'admin';
$password = (string)$body['password'];

// Bootstrap-вход суперадминистратора.
if ($username === 'admin' && ADMIN_BOOTSTRAP_PASSWORD !== '' && $password === ADMIN_BOOTSTRAP_PASSWORD) {
    $token = jwt_sign(array('sub' => 'admin', 'role' => 'admin'), JWT_SECRET);
    api_send_json(array('token' => $token, 'role' => 'admin', 'username' => 'admin'), 200);
}

$users = store_get_json(USERS_FILE, array());
$found = null;
foreach ($users as $u) {
    if (isset($u['username']) && strtolower($u['username']) === strtolower($username)) {
        $found = $u;
        break;
    }
}
if ($found === null) {
    api_send_error(401, 'Неверный логин или пароль');
}
$hash = jwt_hash_password($password, $found['salt']);
if (!hash_equals($found['passwordHash'], $hash)) {
    api_send_error(401, 'Неверный логин или пароль');
}

$token = jwt_sign(array('sub' => $found['username'], 'role' => $found['role']), JWT_SECRET);
api_send_json(array('token' => $token, 'role' => $found['role'], 'username' => $found['username']), 200);
