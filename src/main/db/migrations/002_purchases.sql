-- M6: purchase date + purchase returns (append-only; the original purchase is never edited)
ALTER TABLE purchases ADD COLUMN purchase_date TEXT;
UPDATE purchases SET purchase_date = substr(created_at, 1, 10) WHERE purchase_date IS NULL;

CREATE TABLE IF NOT EXISTS purchase_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  supplier_id INTEGER NOT NULL REFERENCES parties(id),
  total INTEGER NOT NULL,
  note TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  purchase_line_id INTEGER NOT NULL REFERENCES purchase_lines(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  lot_id INTEGER REFERENCES stock_lots(id),
  qty_base INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase ON purchase_lines(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_lines_line ON purchase_return_lines(purchase_line_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_lot ON stock_movements(lot_id);
