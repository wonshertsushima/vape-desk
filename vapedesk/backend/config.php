<?php
// Edit these for your server (XAMPP defaults shown).
const DB_HOST = '127.0.0.1';
const DB_PORT = 3306; // change to 3307 only if you moved MySQL to another port
const DB_NAME = 'vapedesk';
const DB_USER = 'root';
const DB_PASS = '';

session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');

class ApiError extends Exception {}

function fail(string $msg, int $code = 400): never {
    throw new ApiError($msg, $code);
}

function db(): PDO {
    static $pdo = null;
    if (!$pdo) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

function input(): array {
    $d = json_decode(file_get_contents('php://input'), true);
    return is_array($d) ? $d : [];
}

function user(): ?array {
    return $_SESSION['user'] ?? null;
}

// Role-based access control: call at the top of every protected action.
function need(string ...$roles): array {
    $u = user();
    if (!$u) fail('Please log in.', 401);
    if (!in_array($u['role'], $roles, true)) fail('Your role cannot do this.', 403);
    return $u;
}

function audit(string $action, string $detail = ''): void {
    $u = user();
    db()->prepare('INSERT INTO audit_log (user_id, role, action, detail, ip) VALUES (?,?,?,?,?)')
        ->execute([$u['id'] ?? null, $u['role'] ?? null, $action, $detail, $_SERVER['REMOTE_ADDR'] ?? null]);
}
