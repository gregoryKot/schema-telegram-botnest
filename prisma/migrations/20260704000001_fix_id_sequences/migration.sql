-- Переезд с Railway (scripts/migrate-from-railway.js) вставлял строки с явными id,
-- но не сдвигал автоинкремент-последовательности. Из-за этого create в любой
-- импортированной таблице падал с "Unique constraint failed on (`id`)".
-- Выравниваем все последовательности по MAX(id); назад не двигаем.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col,
           pg_get_serial_sequence(format('%I', c.relname), a.attname) AS seq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relkind = 'r'
      AND n.nspname = current_schema()
      AND pg_get_serial_sequence(format('%I', c.relname), a.attname) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(%I) FROM %I), 0) + 1, (SELECT last_value FROM %s)), false)',
      r.seq, r.col, r.tbl, r.seq
    );
  END LOOP;
END $$;
