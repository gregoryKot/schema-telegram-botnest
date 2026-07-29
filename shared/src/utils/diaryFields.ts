/**
 * Собирает необязательные текстовые поля дневниковой записи для payload —
 * пропускает обязательное поле и пустые значения. Общий кусок логики между
 * miniapp/webapp *EntrySheet (правило №3/№11 CLAUDE.md — было продублировано
 * дословно между фронтами при переводе дневника схем на визард).
 */
export function collectFilledFields<K extends string>(
  values: Record<K, string>,
  keys: readonly K[],
  requiredKey: K,
): Partial<Record<K, string>> {
  return Object.fromEntries(
    keys
      .filter((k) => k !== requiredKey && values[k].trim().length > 0)
      .map((k) => [k, values[k]]),
  ) as Partial<Record<K, string>>;
}
