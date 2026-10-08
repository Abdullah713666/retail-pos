-- Pharmacy want-book (append-only; entries are never deleted, 'done' retires them)
CREATE TABLE IF NOT EXISTS pharmacy_want_book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER REFERENCES items(id),
  free_text TEXT,
  supplier_id INTEGER REFERENCES parties(id),
  qty INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL CHECK(source IN ('auto', 'manual')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'ordered', 'done')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(item_id IS NOT NULL OR free_text IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_pharmacy_want_item ON pharmacy_want_book(item_id, status);
