-- Core Database Schema Migration (001_core.sql)

-- 1. Settings (key-value store for app configuration)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 2. Users (authentication and roles)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'manager', 'cashier')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

-- 4. Items (products/catalog)
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  search_text TEXT NOT NULL,
  barcode TEXT UNIQUE,
  category_id INTEGER REFERENCES categories(id),
  base_unit TEXT NOT NULL,
  sale_price INTEGER NOT NULL,
  cost_price INTEGER NOT NULL,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  track_stock INTEGER NOT NULL DEFAULT 1,
  track_lots INTEGER NOT NULL DEFAULT 0,
  stock_cache INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 5. Item Units (pack conversions)
CREATE TABLE IF NOT EXISTS item_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  factor INTEGER NOT NULL,
  barcode TEXT,
  sale_price INTEGER
);

-- 6. Stock Lots (generic batches / tracking)
CREATE TABLE IF NOT EXISTS stock_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  lot_no TEXT NOT NULL,
  expiry_date TEXT,
  cost_price INTEGER NOT NULL,
  sale_price INTEGER,
  created_at TEXT NOT NULL
);

-- 7. Stock Movements (append-only inventory ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  lot_id INTEGER REFERENCES stock_lots(id),
  qty INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('purchase', 'sale', 'sale_return', 'purchase_return', 'adjust', 'opening')),
  ref_type TEXT,
  ref_id INTEGER,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- 8. Parties (customers and suppliers)
CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('customer', 'supplier')),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 9. Party Ledger (khata - append-only debt/credit ledger)
CREATE TABLE IF NOT EXISTS party_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL REFERENCES parties(id),
  type TEXT NOT NULL CHECK(type IN ('opening', 'sale', 'payment_in', 'purchase', 'payment_out', 'return', 'adjust')),
  ref_type TEXT,
  ref_id INTEGER,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- 10. Cash Shifts (cashier register sessions)
CREATE TABLE IF NOT EXISTS cash_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  opened_at TEXT NOT NULL,
  opening_cash INTEGER NOT NULL,
  closed_at TEXT,
  expected_cash INTEGER,
  counted_cash INTEGER,
  note TEXT
);

-- 11. Cash Entries (in, out, expenses during a shift)
CREATE TABLE IF NOT EXISTS cash_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES cash_shifts(id),
  type TEXT NOT NULL CHECK(type IN ('in', 'out', 'expense')),
  amount INTEGER NOT NULL,
  note TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- 12. Sales (completed, held, void invoices)
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE,
  party_id INTEGER REFERENCES parties(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  shift_id INTEGER REFERENCES cash_shifts(id),
  status TEXT NOT NULL CHECK(status IN ('held', 'completed', 'void')),
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  paid_cash INTEGER NOT NULL DEFAULT 0,
  paid_credit INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);

-- 13. Sale Lines (line items of a sale)
CREATE TABLE IF NOT EXISTS sale_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  lot_id INTEGER REFERENCES stock_lots(id),
  unit_name TEXT NOT NULL,
  unit_factor INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  qty_base INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL
);

-- 14. Purchases (supplier inventory receiving)
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES parties(id),
  bill_no TEXT,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- 15. Purchase Lines (line items of a purchase)
CREATE TABLE IF NOT EXISTS purchase_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES items(id),
  lot_id INTEGER REFERENCES stock_lots(id),
  lot_no TEXT,
  expiry_date TEXT,
  unit_name TEXT NOT NULL,
  unit_factor INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  qty_base INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);

-- 16. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL
);

-- Indexes from ARCHITECTURE §6
CREATE INDEX IF NOT EXISTS idx_items_search_text ON items(search_text);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_item_units_barcode ON item_units(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_item_expiry ON stock_lots(item_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_party_ledger_party_id ON party_ledger(party_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
