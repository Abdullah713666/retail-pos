-- M10: reports. Append-only (never edited after release).
-- cost_total = what the goods on this line cost the shop, in paisa, frozen when the sale is completed:
-- SUM(chunk qty * lot cost) for stock-tracked lines, qty_base * item cost for lines without stock tracking.
-- Held bills keep 0 until they are completed.
ALTER TABLE sale_lines ADD COLUMN cost_total INTEGER NOT NULL DEFAULT 0;

-- Fill rows that existed before this column: lot chunks first, else the item's current cost.
UPDATE sale_lines SET cost_total = COALESCE(
  (SELECT SUM(c.qty_base * c.cost_price) FROM sale_line_lots c WHERE c.sale_line_id = sale_lines.id),
  sale_lines.qty_base * (SELECT i.cost_price FROM items i WHERE i.id = sale_lines.item_id)
) WHERE sale_id IN (SELECT id FROM sales WHERE status <> 'held');

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_returns_created ON sale_returns(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_lines_item ON sale_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_party_ledger_party ON party_ledger(party_id);
