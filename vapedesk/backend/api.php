<?php
require __DIR__ . '/config.php';

/**
 * Lock and deduct stock for every item inside the caller's transaction.
 * Prices always come from the database, never from the browser.
 * Returns [lines, total].
 */
function takeStock(array $items, string $reason, ?int $uid): array {
    if (!$items) fail('Cart is empty.');
    usort($items, fn($a, $b) => strcmp((string)$a['sku'], (string)$b['sku'])); // consistent lock order
    $lines = [];
    $total = 0.0;
    foreach ($items as $it) {
        $sku = (string)($it['sku'] ?? '');
        $qty = (int)($it['qty'] ?? 0);
        if ($qty < 1) fail('Invalid quantity.');
        $st = db()->prepare('SELECT id, price, stock FROM variants WHERE sku = ? FOR UPDATE');
        $st->execute([$sku]);
        $v = $st->fetch();
        if (!$v) fail("Unknown item $sku.", 404);
        if ($v['stock'] < $qty) fail("Not enough stock for $sku.", 409);
        db()->prepare('UPDATE variants SET stock = stock - ? WHERE id = ?')->execute([$qty, $v['id']]);
        db()->prepare('INSERT INTO stock_movements (variant_id, user_id, reason, qty_change) VALUES (?,?,?,?)')
            ->execute([$v['id'], $uid, $reason, -$qty]);
        $lines[] = ['variant_id' => $v['id'], 'qty' => $qty, 'price' => $v['price']];
        $total += $v['price'] * $qty;
    }
    return [$lines, round($total, 2)];
}

function inTransaction(callable $fn) {
    db()->beginTransaction();
    try {
        $r = $fn();
        db()->commit();
        return $r;
    } catch (Throwable $e) {
        db()->rollBack();
        throw $e;
    }
}

// Adds the "archived" column to older databases automatically (no SQL needed).
function ensureArchive(): void {
    if (!db()->query("SHOW COLUMNS FROM products LIKE 'archived'")->fetch()) {
        db()->exec('ALTER TABLE products ADD archived TINYINT(1) NOT NULL DEFAULT 0');
    }
}

function skuFor(string $name, array $combo): string {
    $clean = fn($t) => strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $t));
    $parts = [substr($clean($name), 0, 4) ?: 'ITEM'];
    foreach ($combo as $v) $parts[] = substr($clean($v), 0, 4) ?: 'X';
    $base = substr(implode('-', $parts), 0, 52);
    $sku = $base; $n = 2;
    $chk = db()->prepare('SELECT 1 FROM variants WHERE sku = ?');
    while (true) {
        $chk->execute([$sku]);
        if (!$chk->fetch()) return $sku;
        $sku = $base . '-' . $n++;
    }
}

try {
    $action = $_GET['action'] ?? '';
    $in = input();

    switch ($action) {

    /* ---------- accounts ---------- */
    case 'register': // customers only
        $email = filter_var($in['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $name = trim($in['name'] ?? '');
        $pw = (string)($in['password'] ?? '');
        if (!$email || $name === '' || strlen($pw) < 8) fail('Enter a name, a valid email and a password of 8+ characters.');
        try {
            db()->prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?, 'customer')")
                ->execute([$name, $email, password_hash($pw, PASSWORD_DEFAULT)]);
        } catch (PDOException $e) { fail('That email is already registered.', 409); }
        echo json_encode(['ok' => true]);
        break;

    case 'login':
        $st = db()->prepare('SELECT * FROM users WHERE email = ? AND active = 1');
        $st->execute([$in['email'] ?? '']);
        $u = $st->fetch();
        if (!$u || !password_verify((string)($in['password'] ?? ''), $u['password_hash'])) fail('Wrong email or password.', 401);
        session_regenerate_id(true);
        $_SESSION['user'] = ['id' => (int)$u['id'], 'name' => $u['name'], 'role' => $u['role']];
        audit('Login');
        echo json_encode(['user' => $_SESSION['user']]);
        break;

    case 'logout':
        audit('Logout');
        session_destroy();
        echo json_encode(['ok' => true]);
        break;

    case 'me':
        echo json_encode(['user' => user()]);
        break;

    /* ---------- catalog (public) ---------- */
    case 'products':
        ensureArchive();
        $rows = db()->query('SELECT p.id AS pid, p.name, p.category, v.sku, v.flavor, v.size, v.nicotine,
                                    v.resistance, v.price, v.stock, v.reorder_level
                             FROM products p JOIN variants v ON v.product_id = p.id WHERE p.archived = 0 ORDER BY p.id, v.id')->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $out[$r['pid']]['id'] = $r['pid'];
            $out[$r['pid']]['name'] = $r['name'];
            $out[$r['pid']]['category'] = $r['category'];
            $out[$r['pid']]['variants'][] = array_diff_key($r, array_flip(['pid', 'name', 'category']));
        }
        echo json_encode(array_values($out));
        break;

    /* ---------- cashier: POS sale ---------- */
    case 'sale':
        $u = need('cashier');
        $method = in_array($in['payment_method'] ?? '', ['Cash', 'GCash'], true) ? $in['payment_method'] : fail('Choose Cash or GCash.');
        $ref = trim($in['gcash_ref'] ?? '');
        if ($method === 'GCash' && $ref === '') fail('Enter the GCash reference number.');
        $res = inTransaction(function () use ($in, $u, $method, $ref) {
            [$lines, $total] = takeStock($in['items'] ?? [], 'Sale', $u['id']);
            $tend = $method === 'Cash' ? (float)($in['tendered'] ?? 0) : $total;
            if ($tend < $total) fail('Amount tendered is less than the total.');
            db()->prepare('INSERT INTO sales (cashier_id,channel,payment_method,gcash_ref,total,tendered) VALUES (?,?,?,?,?,?)')
                ->execute([$u['id'], 'POS', $method, $ref ?: null, $total, $tend]);
            $id = (int)db()->lastInsertId();
            $no = 'S-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT);
            db()->prepare('UPDATE sales SET receipt_no = ? WHERE id = ?')->execute([$no, $id]);
            foreach ($lines as $l) {
                db()->prepare('INSERT INTO sale_items (sale_id,variant_id,qty,unit_price) VALUES (?,?,?,?)')
                    ->execute([$id, $l['variant_id'], $l['qty'], $l['price']]);
            }
            audit('Sale completed', "$no total $total");
            return ['receipt_no' => $no, 'total' => $total, 'change' => round($tend - $total, 2)];
        });
        echo json_encode($res);
        break;

    /* ---------- customer: online order (reserves stock) ---------- */
    case 'order_place':
        $u = need('customer');
        $method = in_array($in['payment_method'] ?? '', ['Pay at store', 'GCash'], true) ? $in['payment_method'] : fail('Choose a payment method.');
        $ref = trim($in['gcash_ref'] ?? '');
        $slot = trim($in['pickup_slot'] ?? '');
        if ($slot === '') fail('Choose a pickup time.');
        if ($method === 'GCash' && $ref === '') fail('Enter the GCash reference number.');
        $res = inTransaction(function () use ($in, $u, $method, $ref, $slot) {
            [$lines, $total] = takeStock($in['items'] ?? [], 'Online order', $u['id']);
            db()->prepare('INSERT INTO orders (customer_id,pickup_slot,payment_method,gcash_ref,total) VALUES (?,?,?,?,?)')
                ->execute([$u['id'], $slot, $method, $ref ?: null, $total]);
            $id = (int)db()->lastInsertId();
            $no = 'ORD-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT);
            db()->prepare('UPDATE orders SET order_no = ? WHERE id = ?')->execute([$no, $id]);
            foreach ($lines as $l) {
                db()->prepare('INSERT INTO order_items (order_id,variant_id,qty,unit_price) VALUES (?,?,?,?)')
                    ->execute([$id, $l['variant_id'], $l['qty'], $l['price']]);
            }
            audit('Online order placed', $no);
            return ['order_no' => $no, 'total' => $total];
        });
        echo json_encode($res);
        break;

    case 'my_orders':
        $u = need('customer');
        $st = db()->prepare('SELECT order_no, pickup_slot, payment_method, status, total, created_at FROM orders WHERE customer_id = ? ORDER BY id DESC');
        $st->execute([$u['id']]);
        echo json_encode($st->fetchAll());
        break;

    /* ---------- cashier: order queue ---------- */
    case 'orders':
        need('cashier', 'admin');
        echo json_encode(db()->query('SELECT o.order_no, o.pickup_slot, o.payment_method, o.gcash_ref, o.status, o.total, u.name AS customer
                                      FROM orders o JOIN users u ON u.id = o.customer_id ORDER BY o.id DESC')->fetchAll());
        break;

    case 'order_update': // body: {order_no, to: "next" | "cancel"}
        $u = need('cashier');
        $flow = ['Pending', 'Payment Verified', 'Ready for Pickup', 'Completed'];
        $res = inTransaction(function () use ($in, $flow) {
            $st = db()->prepare('SELECT * FROM orders WHERE order_no = ? FOR UPDATE');
            $st->execute([$in['order_no'] ?? '']);
            $o = $st->fetch();
            if (!$o) fail('Order not found.', 404);
            if (in_array($o['status'], ['Completed', 'Cancelled'], true)) fail('This order is already closed.');

            if (($in['to'] ?? '') === 'cancel') {
                $items = db()->prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ?');
                $items->execute([$o['id']]);
                foreach ($items->fetchAll() as $i) {
                    db()->prepare('UPDATE variants SET stock = stock + ? WHERE id = ?')->execute([$i['qty'], $i['variant_id']]);
                    db()->prepare('INSERT INTO stock_movements (variant_id,user_id,reason,qty_change) VALUES (?,?,?,?)')
                        ->execute([$i['variant_id'], user()['id'], 'Order cancelled', $i['qty']]);
                }
                $new = 'Cancelled';
            } else {
                $new = $flow[array_search($o['status'], $flow, true) + 1];
                if ($new === 'Completed') { // record the pickup as a sale
                    db()->prepare('INSERT INTO sales (cashier_id,channel,payment_method,gcash_ref,total,tendered) VALUES (?,?,?,?,?,?)')
                        ->execute([user()['id'], 'Online', $o['payment_method'], $o['gcash_ref'], $o['total'], $o['total']]);
                    $sid = (int)db()->lastInsertId();
                    db()->prepare('UPDATE sales SET receipt_no = ? WHERE id = ?')->execute(['S-' . str_pad((string)$sid, 5, '0', STR_PAD_LEFT), $sid]);
                    db()->prepare('INSERT INTO sale_items (sale_id,variant_id,qty,unit_price)
                                   SELECT ?, variant_id, qty, unit_price FROM order_items WHERE order_id = ?')->execute([$sid, $o['id']]);
                }
            }
            db()->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$new, $o['id']]);
            audit('Order ' . $new, $o['order_no']);
            return ['status' => $new];
        });
        echo json_encode($res);
        break;

    /* ---------- custodian: stock ---------- */
    case 'stock_adjust': // body: {sku, reason, qty}
        $u = need('custodian');
        $reason = $in['reason'] ?? '';
        if (!in_array($reason, ['Delivery', 'Damage', 'Recount', 'Shrinkage'], true)) fail('Choose a reason.');
        $qty = (int)($in['qty'] ?? 0);
        if ($qty < 1) fail('Enter a quantity above 0.');
        $delta = $reason === 'Delivery' ? $qty : -$qty;
        $res = inTransaction(function () use ($in, $u, $reason, $delta) {
            $st = db()->prepare('SELECT id, stock FROM variants WHERE sku = ? FOR UPDATE');
            $st->execute([$in['sku'] ?? '']);
            $v = $st->fetch();
            if (!$v) fail('Unknown item.', 404);
            if ($v['stock'] + $delta < 0) fail('Stock cannot go below 0.', 409);
            db()->prepare('UPDATE variants SET stock = stock + ? WHERE id = ?')->execute([$delta, $v['id']]);
            db()->prepare('INSERT INTO stock_movements (variant_id,user_id,reason,qty_change) VALUES (?,?,?,?)')
                ->execute([$v['id'], $u['id'], $reason, $delta]);
            audit('Stock ' . $reason, $in['sku'] . ': ' . $v['stock'] . ' to ' . ($v['stock'] + $delta));
            return ['stock' => $v['stock'] + $delta];
        });
        echo json_encode($res);
        break;

    case 'product_create': // custodian adds a new product with its variants and starting stock
        $u = need('custodian');
        $name = trim($in['name'] ?? '');
        $cat = trim($in['category'] ?? '');
        $price = round((float)($in['price'] ?? 0), 2);
        $stock = (int)($in['stock'] ?? 0);
        $reorder = max(0, (int)($in['reorder'] ?? 5));
        if ($name === '' || $cat === '') fail('Enter a product name and category.');
        if ($price <= 0) fail('Price must be above 0.');
        if ($stock < 0) fail('Stock cannot be negative.');
        $cols = ['Flavor' => 'flavor', 'Size' => 'size', 'Nicotine' => 'nicotine', 'Resistance' => 'resistance'];
        $combos = [[]];
        foreach ($cols as $label => $col) {
            $vals = array_values(array_unique(array_filter(array_map('trim', (array)($in['attrs'][$label] ?? [])), 'strlen')));
            if (!$vals) continue;
            $next = [];
            foreach ($combos as $c) foreach ($vals as $v) $next[] = $c + [$col => $v];
            $combos = $next;
            if (count($combos) > 200) fail('Too many variants (maximum 200).');
        }
        $res = inTransaction(function () use ($u, $name, $cat, $price, $stock, $reorder, $combos) {
            db()->prepare('INSERT INTO products (name, category) VALUES (?,?)')->execute([$name, $cat]);
            $pid = (int)db()->lastInsertId();
            foreach ($combos as $c) {
                db()->prepare('INSERT INTO variants (product_id,sku,flavor,size,nicotine,resistance,price,stock,reorder_level) VALUES (?,?,?,?,?,?,?,?,?)')
                    ->execute([$pid, skuFor($name, $c), $c['flavor'] ?? null, $c['size'] ?? null, $c['nicotine'] ?? null, $c['resistance'] ?? null, $price, $stock, $reorder]);
                $vid = (int)db()->lastInsertId();
                if ($stock > 0) {
                    db()->prepare('INSERT INTO stock_movements (variant_id,user_id,reason,qty_change) VALUES (?,?,?,?)')
                        ->execute([$vid, $u['id'], 'Delivery', $stock]);
                }
            }
            audit('Product added', $name . ' (' . count($combos) . ' variants)');
            return ['variants' => count($combos)];
        });
        echo json_encode($res);
        break;

    case 'product_delete': // body: {id}. Removes it, or archives it if it has sales history.
        need('custodian');
        ensureArchive();
        $id = (int)($in['id'] ?? 0);
        $res = inTransaction(function () use ($id) {
            $st = db()->prepare('SELECT name FROM products WHERE id = ? AND archived = 0 FOR UPDATE');
            $st->execute([$id]);
            $p = $st->fetch();
            if (!$p) fail('Product not found.', 404);
            $open = db()->prepare("SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                                   JOIN variants v ON v.id = oi.variant_id
                                   WHERE v.product_id = ? AND o.status NOT IN ('Completed','Cancelled')");
            $open->execute([$id]);
            if ($open->fetchColumn() > 0) fail('This product has open online orders. Complete or cancel them first.', 409);
            $h = db()->prepare('SELECT (SELECT COUNT(*) FROM sale_items si JOIN variants v ON v.id = si.variant_id WHERE v.product_id = ?)
                              + (SELECT COUNT(*) FROM order_items oi JOIN variants v ON v.id = oi.variant_id WHERE v.product_id = ?)');
            $h->execute([$id, $id]);
            if ($h->fetchColumn() > 0) {
                db()->prepare('UPDATE products SET archived = 1 WHERE id = ?')->execute([$id]);
                $mode = 'archived';
            } else {
                db()->prepare('DELETE sm FROM stock_movements sm JOIN variants v ON v.id = sm.variant_id WHERE v.product_id = ?')->execute([$id]);
                db()->prepare('DELETE FROM variants WHERE product_id = ?')->execute([$id]);
                db()->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);
                $mode = 'removed';
            }
            audit('Product ' . $mode, $p['name']);
            return ['result' => $mode];
        });
        echo json_encode($res);
        break;

    case 'price_set': // body: {sku, price}
        $u = need('custodian');
        $price = round((float)($in['price'] ?? 0), 2);
        if ($price <= 0) fail('Price must be above 0.');
        $res = inTransaction(function () use ($in, $price) {
            $st = db()->prepare('SELECT id, price FROM variants WHERE sku = ? FOR UPDATE');
            $st->execute([$in['sku'] ?? '']);
            $v = $st->fetch();
            if (!$v) fail('Unknown item.', 404);
            db()->prepare('UPDATE variants SET price = ? WHERE id = ?')->execute([$price, $v['id']]);
            audit('Price change', $in['sku'] . ': ' . $v['price'] . ' to ' . $price);
            return ['price' => $price];
        });
        echo json_encode($res);
        break;

    /* ---------- admin ---------- */
    case 'dashboard':
        need('admin');
        ensureArchive();
        echo json_encode([
            'sales_today'   => (float)db()->query('SELECT COALESCE(SUM(total),0) FROM sales WHERE DATE(created_at)=CURDATE()')->fetchColumn(),
            'transactions'  => (int)db()->query('SELECT COUNT(*) FROM sales WHERE DATE(created_at)=CURDATE()')->fetchColumn(),
            'pending_orders'=> (int)db()->query("SELECT COUNT(*) FROM orders WHERE status NOT IN ('Completed','Cancelled')")->fetchColumn(),
            'low_stock'     => (int)db()->query('SELECT COUNT(*) FROM variants v JOIN products p ON p.id = v.product_id WHERE p.archived = 0 AND v.stock <= v.reorder_level')->fetchColumn(),
            'last_7_days'   => db()->query('SELECT DATE(created_at) AS day, SUM(total) AS total FROM sales
                                            WHERE created_at >= CURDATE() - INTERVAL 6 DAY GROUP BY day ORDER BY day')->fetchAll(),
            'top_variants'  => db()->query('SELECT v.sku, SUM(si.qty) AS sold FROM sale_items si JOIN variants v ON v.id = si.variant_id
                                            JOIN sales s ON s.id = si.sale_id WHERE DATE(s.created_at)=CURDATE()
                                            GROUP BY v.sku ORDER BY sold DESC LIMIT 5')->fetchAll(),
        ]);
        break;

    case 'audit_log':
        need('admin');
        echo json_encode(db()->query('SELECT created_at, role, action, detail, ip FROM audit_log ORDER BY id DESC LIMIT 200')->fetchAll());
        break;

    default:
        fail('Unknown action.', 404);
    }
} catch (ApiError $e) {
    http_response_code($e->getCode() ?: 400);
    echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    error_log($e->getMessage());
    echo json_encode(['error' => 'Something went wrong on the server.']);
}
