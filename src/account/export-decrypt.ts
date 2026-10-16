import {
  EncryptSchema,
  decryptRecord,
  unreadableFields,
} from '../utils/crypto';

type Row = Record<string, unknown>;

/**
 * decryptRecord для выгрузки «все мои данные». Нечитаемый список приходит
 * пустым `[]` — в файле, который человек получает как полную копию, это
 * выглядело бы как «ничего не было». Поэтому имена не прочитавшихся полей
 * лежат рядом (`_unreadableFields`), а не пропадают молча.
 */
export function decryptExport(row: Row, schema: EncryptSchema): Row {
  const out = decryptRecord(row, schema);
  const bad = unreadableFields(out);
  return bad.length > 0 ? { ...out, _unreadableFields: bad } : out;
}
