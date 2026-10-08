-- M9: cash shifts. Append-only (never edited after release).
-- Only one shift can be open at a time (single till / single PC).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_shifts_one_open ON cash_shifts((1)) WHERE closed_at IS NULL;

-- Which shift's drawer each cash movement belongs to (NULL = no shift was open at the time).
-- sales.shift_id already exists (001); void_shift_id is the shift whose drawer paid the refund of a void.
ALTER TABLE sales ADD COLUMN void_shift_id INTEGER REFERENCES cash_shifts(id);
ALTER TABLE sale_returns ADD COLUMN shift_id INTEGER REFERENCES cash_shifts(id);
ALTER TABLE purchases ADD COLUMN shift_id INTEGER REFERENCES cash_shifts(id);
-- Standalone khata payments (customer pays in / shop pays supplier), not the ones made with a purchase.
ALTER TABLE party_ledger ADD COLUMN shift_id INTEGER REFERENCES cash_shifts(id);

CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_void_shift ON sales(void_shift_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_shift ON sale_returns(shift_id);
CREATE INDEX IF NOT EXISTS idx_purchases_shift ON purchases(shift_id);
CREATE INDEX IF NOT EXISTS idx_party_ledger_shift ON party_ledger(shift_id);
CREATE INDEX IF NOT EXISTS idx_cash_entries_shift ON cash_entries(shift_id);
