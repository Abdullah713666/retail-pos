-- Pharmacy module initial migration (pharmacy/001_init)
CREATE TABLE IF NOT EXISTS pharmacy_item_info (
  item_id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  generic_name TEXT,
  manufacturer TEXT,
  strength TEXT,
  form TEXT,
  schedule TEXT CHECK(schedule IN ('otc', 'rx', 'controlled')),
  rack TEXT
);
