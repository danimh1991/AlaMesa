-- User-requested one-time reset. Preserve catalog, recipes and preferences.
UPDATE household
SET data = json_set(data, '$.menus', json('{}'), '$.shopping', json('{"items":[],"included":{}}')),
    revision = revision + 1
WHERE id = 1;
