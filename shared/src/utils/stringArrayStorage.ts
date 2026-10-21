// Хранение списка строк в localStorage (per-device) — общий примитив для
// скрытия (quickActionPrefs) и порядка (quickActionOrder) быстрых действий.
// Один разбор на обе механики (правило «одна механика — один компонент»);
// логика под тестами потребителей: parse-случаи в quickActionPrefs.test.ts
// и quickActionOrder.test.ts.

/** Битый JSON/не-массив/не-строки внутри → пустой список. */
export function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

export function serializeStringArray(ids: string[]): string {
  return JSON.stringify(ids);
}

export function readStringArray(key: string): string[] {
  return parseStringArray(localStorage.getItem(key));
}

/** Пустой список не хранится — ключ удаляется (дефолт читается как пусто). */
export function writeStringArray(key: string, ids: string[]): void {
  if (ids.length === 0) localStorage.removeItem(key);
  else localStorage.setItem(key, serializeStringArray(ids));
}
