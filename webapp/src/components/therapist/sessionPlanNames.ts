/** Названия пунктов плана, отмеченных в записи сессии; пункта, которого уже нет, молча нет. */
export function planNamesOf(ids: number[] | undefined, titles: ReadonlyMap<number, string>): string[] {
  return (ids ?? []).flatMap((id) => {
    const t = titles.get(id)?.trim();
    return t ? [t] : [];
  });
}
