-- M7: sales. Append-only (never edited after release).
-- Held bills are rows in `sales` with status 'held' (no invoice number yet).

ALTER TABLE sales ADD COLUMN bill_discount INTEGER NOT NULL DEFAULT 0;
-- Percent discounts are kept in basis points (250 = 2.5%) so a held bill restores exactly what was typed.
ALTER TABLE sales ADD COLUMN bill_discount_bp INTEGER;
ALTER TABLE sales ADD COLUMN voided_at TEXT;
ALTER TABLE sales ADD COLUMN voided_by INTEGER REFERENCES users(id);
ALTER TABLE sales ADD COLUMN void_reason TEXT;

-- item_name is a snapshot so receipts/reports survive later renames.
ALTER TABLE sale_lines ADD COLUMN item_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sale_lines ADD COLUMN discount_bp INTEGER;
-- line_total = unit_price*qty - discount. net_total = line_total minus this line's share of the
-- bill discount; SUM(net_total) = sales.total. Refunds are based on net_total.
ALTER TABLE sale_lines ADD COLUMN net_total INTEGER NOT NULL DEFAULT 0;

-- Which lot(s) each line took stock from (a line can span several lots). cost_price is per base unit.
CREATE TABLE IF NOT EXISTS sale_line_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_line_id INTEGER NOT NULL REFERENCES sale_lines(id) ON DELETE CASCADE,
  lot_id INTEGER REFERENCES stock_lots(id),
  qty_base INTEGER NOT NULL,
  cost_price INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  party_id INTEGER REFERENCES parties(id),
  total INTEGER NOT NULL,
  refund_cash INTEGER NOT NULL DEFAULT 0,
  refund_credit INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- One row per (sale line, lot) chunk returned; refund amount sits on the first chunk of a line.
CREATE TABLE IF NOT EXISTS sale_return_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  sale_line_id INTEGER NOT NULL REFERENCES sale_lines(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  lot_id INTEGER REFERENCES stock_lots(id),
  qty_base INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_lines_sale ON sale_lines(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_line_lots_line ON sale_line_lots(sale_line_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_lines_line ON sale_return_lines(sale_line_id);
