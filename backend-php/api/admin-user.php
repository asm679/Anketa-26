<?php
// PUT    /api/admin/users/{id} — изменение пользователя.
// DELETE /api/admin/users/{id} — удаление пользователя.
// id передаётся через query-параметр ?id=... (см. .htaccess).
define('ANKETA_ENTRY', true);
require_once __DIR__ . '/lib/common.php';

api_bootstrap();

function admin_user_public($u) {
    return array(
        'id' => $u['id'],
        'username' => $u['username'],
        'role' => $u['role'],
        'createdAt' => $u['createdAt'],
        'updatedAt' => $u['updatedAt'],
    );
}

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? $_GET['id'] : null;
if (!$id) {
    api_send_error(400, 'Не указан идентификатор пользователя');
}

if ($method === 'PUT') {
    api_require_auth(array('admin'));
    $body = api_read_json_body();
    if (!is_array($body)) {
        $body = array();
    }

    $result = store_update_json(USERS_FILE, array(), function (&$users) use ($id, $body) {
        foreach ($users as $idx => $u) {
            if ($u['id'] === $id) {
                if (!empty($body['username'])) {
                    $users[$idx]['username'] = $body['username'];
                }
                if (!empty($body['role'])) {
                    if (!in_array($body['role'], array('admin', 'viewer'), true)) {
                        return array('error' => 'invalid_role');
                    }
                    $users[$idx]['role'] = $body['role'];
                }
                if (!empty($body['password'])) {
                    $salt = jwt_random_salt();
                    $users[$idx]['salt'] = $salt;
                    $users[$idx]['passwordHash'] = jwt_hash_password($body['password'], $salt);
                }
                $users[$idx]['updatedAt'] = gmdate('Y-m-d\TH:i:s\Z');
                return array('user' => $users[$idx]);
            }
        }
        return array('error' => 'not_found');
    });

    if (isset($result['error'])) {
        if ($result['error'] === 'invalid_role') {
            api_send_error(400, 'Недопустимая роль');
        }
        api_send_error(404, 'Пользователь не найден');
    }
    api_send_json(admin_user_public($result['user']), 200);
} elseif ($method === 'DELETE') {
    api_require_auth(array('admin'));

    $result = store_update_json(USERS_FILE, array(), function (&$users) use ($id) {
        $before = count($users);
        $users = array_values(array_filter($users, function ($u) use ($id) {
            return $u['id'] !== $id;
        }));
        return array('deleted' => $before !== count($users));
    });

    if (!$result['deleted']) {
        api_send_error(404, 'Пользователь не найден');
    }
    api_send_json(array('ok' => true), 200);
} else {
    api_send_error(405, 'Метод не поддерживается');
}
