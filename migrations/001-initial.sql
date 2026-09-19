CREATE TABLE IF NOT EXISTS cattle_lots (id TEXT PRIMARY KEY, farm_unit_id TEXT NOT NULL, name TEXT NOT NULL, purpose TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cattle_animals (id TEXT PRIMARY KEY, farm_unit_id TEXT NOT NULL, lot_id TEXT, tag TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cattle_weights (id TEXT PRIMARY KEY, animal_id TEXT NOT NULL, weight_kg REAL NOT NULL, measured_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cattle_events (id TEXT PRIMARY KEY, animal_id TEXT NOT NULL, event_type TEXT NOT NULL, occurred_at TEXT NOT NULL, payload_json TEXT);
