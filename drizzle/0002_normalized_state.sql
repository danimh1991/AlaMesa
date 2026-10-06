-- Split the legacy household JSON into independently readable aggregates.
-- Keep household untouched as a recoverable snapshot during the transition.
CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  settings TEXT NOT NULL,
  write_token TEXT
);

CREATE TABLE IF NOT EXISTS dish_changes (
  dish_id INTEGER PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('override', 'added', 'deleted')),
  data TEXT
);

CREATE TABLE IF NOT EXISTS menus (
  month TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS available_food (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_state (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discovery_state (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  data TEXT NOT NULL
);

INSERT OR REPLACE INTO app_state (id, revision, settings, write_token)
SELECT 1, revision, json_extract(data, '$.settings'), NULL FROM household WHERE id = 1;

DELETE FROM dish_changes;
INSERT OR REPLACE INTO dish_changes (dish_id, kind, data)
SELECT CAST(key AS INTEGER), 'override', json(value) FROM household, json_each(household.data, '$.overrides') WHERE household.id = 1;
INSERT OR REPLACE INTO dish_changes (dish_id, kind, data)
SELECT CAST(json_extract(value, '$.id') AS INTEGER), 'added', json(value) FROM household, json_each(household.data, '$.added') WHERE household.id = 1;
INSERT OR REPLACE INTO dish_changes (dish_id, kind, data)
SELECT CAST(value AS INTEGER), 'deleted', NULL FROM household, json_each(household.data, '$.deletedDishIds') WHERE household.id = 1;

DELETE FROM menus;
INSERT INTO menus (month, data)
SELECT key, json(value) FROM household, json_each(household.data, '$.menus') WHERE household.id = 1;

DELETE FROM available_food;
INSERT INTO available_food (id, data)
SELECT json_extract(value, '$.id'), json(value) FROM household, json_each(household.data, '$.availableFood') WHERE household.id = 1;

DELETE FROM shopping_state;
INSERT INTO shopping_state (id, data)
SELECT 1, json_extract(data, '$.shopping') FROM household WHERE id = 1 AND json_type(data, '$.shopping') IS NOT NULL;

DELETE FROM discovery_state;
INSERT INTO discovery_state (id, data)
SELECT 1, json_extract(data, '$.discovery') FROM household WHERE id = 1 AND json_type(data, '$.discovery') IS NOT NULL;
