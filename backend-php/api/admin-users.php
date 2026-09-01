<?php
// GET  /api/admin/users — список пользователей (без хэшей паролей).
// POST /api/admin/users — создание нового пользователя.
define('ANKETA_ENTRY', true);
require_once __DIR__ . '/lib/common.php';

api_bootstrap();

function admin_users_public($u) {
    return array(
        'id' => $u['id'],
        'username' => $u['username'],
        'role' => $u['role'],
        'createdAt' => $u['createdAt'],
        'updatedAt' => $u['updatedAt'],
    );
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    api_require_auth(array('admin'));
    $users = store_get_json(USERS_FILE, array());
    $safe = array();
    foreach ($users as $u) {
        $safe[] = admin_users_public($u);
    }
    api_send_json($safe, 200);
} elseif ($method === 'POST') {
    api_require_auth(array('admin'));
    $body = api_read_json_body();
    if (!is_array($body) || empty($body['username']) || empty($body['password']) || empty($body['role'])) {
        api_send_error(400, 'Укажите username, password и role');
    }
    if (!in_array($body['role'], array('admin', 'viewer'), true)) {
        api_send_error(400, 'Недопустимая роль');
    }

    $username = $body['username'];
    $password = $body['password'];
    $role = $body['role'];

    $result = store_update_json(USERS_FILE, array(), function (&$users) use ($username, $password, $role) {
        foreach ($users as $u) {
            if (strtolower($u['username']) === strtolower($username)) {
                return array('conflict' => true);
            }
        }
        $salt = jwt_random_salt();
        $now = gmdate('Y-m-d\TH:i:s\Z');
        $newUser = array(
            'id' => jwt_random_id(),
            'username' => $username,
            'salt' => $salt,
            'passwordHash' => jwt_hash_password($password, $salt),
            'role' => $role,
            'createdAt' => $now,
            'updatedAt' => $now,
        );
        $users[] = $newUser;
        return array('conflict' => false, 'user' => $newUser);
    });

    if ($result['conflict']) {
        api_send_error(409, 'Пользователь с таким именем уже существует');
    }
    api_send_json(admin_users_public($result['user']), 201);
} else {
    api_send_error(405, 'Метод не поддерживается');
}
