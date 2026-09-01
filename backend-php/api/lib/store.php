<?php
// Локальное JSON-хранилище на файловой системе (взамен GitHub-хранилища из Cloudflare Worker).
// Использует блокировки файлов (flock) для безопасной конкурентной записи.

if (!defined('ANKETA_ENTRY')) {
    http_response_code(403);
    exit;
}

function store_path($relativePath) {
    $base = DATA_DIR;
    if (!is_dir($base)) {
        @mkdir($base, 0755, true);
    }
    return $base . '/' . ltrim($relativePath, '/');
}

// Читает JSON-файл. Возвращает $default, если файла нет или он повреждён.
function store_get_json($relativePath, $default) {
    $full = store_path($relativePath);
    if (!file_exists($full)) {
        return $default;
    }
    $fh = @fopen($full, 'r');
    if ($fh === false) {
        return $default;
    }
    flock($fh, LOCK_SH);
    $content = stream_get_contents($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    $data = json_decode($content, true);
    if ($data === null) {
        return $default;
    }
    return $data;
}

// Атомарно записывает JSON-файл (через временный файл + rename).
function store_put_json($relativePath, $data) {
    $full = store_path($relativePath);
    $dir = dirname($full);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $tmp = $full . '.tmp.' . getmypid() . '.' . mt_rand(1000, 9999);
    $fh = fopen($tmp, 'w');
    if ($fh === false) {
        throw new Exception('Не удалось открыть файл для записи: ' . $relativePath);
    }
    flock($fh, LOCK_EX);
    fwrite($fh, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    rename($tmp, $full);
}

// Атомарное чтение-изменение-запись с эксклюзивной блокировкой на весь цикл.
// $callback принимает $data по ссылке и модифицирует его; возвращаемое значение
// callback передаётся наружу.
function store_update_json($relativePath, $default, $callback) {
    $full = store_path($relativePath);
    $dir = dirname($full);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $fh = fopen($full, 'c+');
    if ($fh === false) {
        throw new Exception('Не удалось открыть файл: ' . $relativePath);
    }
    flock($fh, LOCK_EX);
    $content = stream_get_contents($fh);
    $data = ($content !== false && $content !== '') ? json_decode($content, true) : null;
    if ($data === null) {
        $data = $default;
    }
    $result = $callback($data);
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, $encoded);
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}

function store_file_exists($relativePath) {
    return file_exists(store_path($relativePath));
}

// Список имён файлов в подкаталоге (без "." и "..").
function store_list_dir($relativePath) {
    $full = store_path($relativePath);
    if (!is_dir($full)) {
        return array();
    }
    $files = scandir($full);
    $result = array();
    foreach ($files as $f) {
        if ($f === '.' || $f === '..') {
            continue;
        }
        $result[] = $f;
    }
    return $result;
}
