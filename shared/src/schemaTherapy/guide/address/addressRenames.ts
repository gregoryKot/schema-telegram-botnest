// Реестр переименований адресов справочника: старый адрес → новый. Поле,
// раздел или статья переименованы либо удалены — строка здесь в том же PR,
// иначе тест-сторож `address.test.ts` красный, а отметки клиентов теряются.
// Ключ с `*` вместо id статьи переименовывает поле у всех статей вида:
// `'mode:*/experiential': 'mode:*/feelings'`.
export const GUIDE_ADDRESS_RENAMES: Readonly<Record<string, string>> = {};

const MAX_HOPS = 16;

function renameOnce(
  address: string,
  renames: Readonly<Record<string, string>>,
): string | null {
  if (renames[address]) return renames[address];
  const m = /^([a-z]+):([^/]+)\/(.+)$/.exec(address);
  if (!m) return null;
  const wildcard = renames[`${m[1]}:*/${m[3]}`];
  return wildcard ? wildcard.replace('*', m[2]) : null;
}

/** Адрес, проведённый через реестр до конца цепочки; без записи — как есть. */
export function normalizeAddress(
  address: string,
  renames: Readonly<Record<string, string>> = GUIDE_ADDRESS_RENAMES,
): string {
  let current = address;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const next = renameOnce(current, renames);
    if (!next || next === current) return current;
    current = next;
  }
  return current;
}
