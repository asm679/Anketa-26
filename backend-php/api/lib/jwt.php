<?php
// Минимальная реализация HS256 JWT и хеширования паролей на стандартных функциях PHP
// (hash_hmac, openssl_random_pseudo_bytes) — совместимо с PHP 5.6+, без внешних зависимостей.

if (!defined('ANKETA_ENTRY')) {
    http_response_code(403);
    exit;
}

function jwt_base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function jwt_base64url_decode($data) {
    $b64 = strtr($data, '-_', '+/');
    $pad = strlen($b64) % 4;
    if ($pad > 0) {
        $b64 .= str_repeat('=', 4 - $pad);
    }
    return base64_decode($b64);
}

function jwt_sign($payload, $secret, $expiresInSeconds = 28800) {
    $header = array('alg' => 'HS256', 'typ' => 'JWT');
    $now = time();
    $payload['iat'] = $now;
    $payload['exp'] = $now + $expiresInSeconds;
    $encHeader = jwt_base64url_encode(json_encode($header));
    $encPayload = jwt_base64url_encode(json_encode($payload));
    $data = $encHeader . '.' . $encPayload;
    $sig = hash_hmac('sha256', $data, $secret, true);
    $encSig = jwt_base64url_encode($sig);
    return $data . '.' . $encSig;
}

function jwt_verify($token, $secret) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new Exception('malformed token');
    }
    list($encHeader, $encPayload, $encSig) = $parts;
    $data = $encHeader . '.' . $encPayload;
    $expectedSig = jwt_base64url_encode(hash_hmac('sha256', $data, $secret, true));
    if (!hash_equals($expectedSig, $encSig)) {
        throw new Exception('invalid signature');
    }
    $payload = json_decode(jwt_base64url_decode($encPayload), true);
    if (!is_array($payload)) {
        throw new Exception('invalid payload');
    }
    if (isset($payload['exp']) && time() > $payload['exp']) {
        throw new Exception('token expired');
    }
    return $payload;
}

function jwt_hash_password($password, $salt) {
    return hash('sha256', $salt . $password);
}

function jwt_random_salt() {
    return bin2hex(openssl_random_pseudo_bytes(16));
}

function jwt_random_id() {
    $data = openssl_random_pseudo_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    $hex = bin2hex($data);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
}
