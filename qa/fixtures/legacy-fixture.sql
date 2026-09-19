PRAGMA journal_mode=DELETE;
CREATE TABLE legacy_farms(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE legacy_animals(
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  farm_id TEXT NOT NULL,
  status TEXT NOT NULL,
  weight_kg REAL,
  FOREIGN KEY(farm_id) REFERENCES legacy_farms(id)
);
CREATE TABLE legacy_notes(
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL,
  note TEXT NOT NULL,
  FOREIGN KEY(animal_id) REFERENCES legacy_animals(id)
);
INSERT INTO legacy_farms(id,name,created_at) VALUES
  ('farm-fixture-1','Fazenda Homologação','2026-01-01T00:00:00.000Z');
INSERT INTO legacy_animals(id,tag,farm_id,status,weight_kg) VALUES
  ('animal-fixture-1','FIX-0001','farm-fixture-1','active',412.5),
  ('animal-fixture-2','FIX-0002','farm-fixture-1','active',398.2);
INSERT INTO legacy_notes(id,animal_id,note) VALUES
  ('note-fixture-1','animal-fixture-1','Registro de homologação preservado durante migração.');
