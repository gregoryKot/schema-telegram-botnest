// Детали листа подсказок (GuideSheet.tsx, стили — therapist-guide.css): реплики «Как это звучит» и списки пунктов.

/** «Как это звучит»: реплики терапевта на бумаге листа (группы, домена); кавычки ставит лист, в данных их нет. */
export function GuideVoice({ lines = [] }: { lines?: string[] }) {
  const said = lines.filter((l) => l.trim());
  if (said.length === 0) return null;
  return (
    <section aria-label="Как это звучит" className="pp-paper gd-voice">
      <h3 className="ds-label gd-label">Как это звучит</h3>
      {said.map((line, i) => <blockquote key={i} className="gd-voice-line">«{line}»</blockquote>)}
    </section>
  );
}

/** Пункт списка: строка или подпись канала работы над строкой. */
export type GuidePoint = string | { lead: string; text: string };

/** Шаги (`ordered`: номер Literata слева, тихо) или главные пункты (маленькая точка). */
export function GuidePoints({ items, ordered }: { items: GuidePoint[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={ordered ? 'gd-steps' : 'gd-points'}>
      {items.map((item, i) => (
        <li key={i}>
          {typeof item === 'string' ? item : <><span className="gd-lead">{item.lead}</span>{item.text}</>}
        </li>
      ))}
    </List>
  );
}
