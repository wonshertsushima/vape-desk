CREATE DATABASE IF NOT EXISTS vapedesk CHARACTER SET utf8mb4;
USE vapedesk;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','cashier','custodian','customer') NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Parent product
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(50) NOT NULL,
  archived TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Child variant: one row per flavor/size/nicotine/resistance combination
CREATE TABLE variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  sku VARCHAR(60) NOT NULL UNIQUE,
  flavor VARCHAR(50) NULL,
  size VARCHAR(20) NULL,
  nicotine VARCHAR(20) NULL,
  resistance VARCHAR(20) NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 5,
  CHECK (stock >= 0),
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX (product_id)
) ENGINE=InnoDB;

CREATE TABLE sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_no VARCHAR(20) NULL UNIQUE,
  cashier_id INT NULL,
  channel ENUM('POS','Online') NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  gcash_ref VARCHAR(40) NULL,
  total DECIMAL(10,2) NOT NULL,
  tendered DECIMAL(10,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cashier_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  variant_id INT NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (variant_id) REFERENCES variants(id)
) ENGINE=InnoDB;

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(20) NULL UNIQUE,
  customer_id INT NOT NULL,
  pickup_slot VARCHAR(50) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  gcash_ref VARCHAR(40) NULL,
  status ENUM('Pending','Payment Verified','Ready for Pickup','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  variant_id INT NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (variant_id) REFERENCES variants(id)
) ENGINE=InnoDB;

CREATE TABLE stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  variant_id INT NOT NULL,
  user_id INT NULL,
  reason VARCHAR(30) NOT NULL,
  qty_change INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES variants(id)
) ENGINE=InnoDB;

CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  role VARCHAR(20) NULL,
  action VARCHAR(60) NOT NULL,
  detail VARCHAR(255) NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (created_at)
) ENGINE=InnoDB;

-- Sample data
INSERT INTO products (name, category) VALUES
 ('Cloud Nine E-Liquid','E-liquids'),('MeshPro Replacement Coil','Coils');
INSERT INTO variants (product_id, sku, flavor, size, nicotine, resistance, price, stock) VALUES
 (1,'EL-MAN-30-3','Mango','30ml','3mg',NULL,350,12),
 (1,'EL-MAN-30-6','Mango','30ml','6mg',NULL,350,8),
 (1,'EL-MEN-60-24','Menthol','60ml','24mg',NULL,500,4),
 (2,'COIL-06',NULL,NULL,NULL,'0.6Ω',120,20),
 (2,'COIL-08',NULL,NULL,NULL,'0.8Ω',120,15);

-- Staff accounts are created by opening setup.php once in the browser (no SQL editing needed).
