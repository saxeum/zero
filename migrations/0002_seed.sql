-- Seed rows, in their own migration so tests can re-run exactly this SQL to reset.
-- Keep each statement on one line: D1's exec() splits its input on newlines.
INSERT INTO items (id, text) VALUES ('seed-1', 'learn useEffect'), ('seed-2', 'fetch from the server');
