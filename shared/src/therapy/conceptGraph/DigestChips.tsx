import { ConceptMark, ConceptTag } from './conceptPaper';
import type { DigestItem } from './conceptDigestModel';
import { runStarts } from '../../utils/runStarts';

// Знак в начале подписи группы («✗ блокированы:») рисуется тихим значком-путём, текст модели (он же идёт в экспорт) не меняется.
const CAPTION_MARK = { '✗': 'block', '✓': 'meet' } as const;

function Caption({ text }: { text: string }) {
  const glyph = text.charAt(0);
  const kind = Object.hasOwn(CAPTION_MARK, glyph)
    ? CAPTION_MARK[glyph as keyof typeof CAPTION_MARK]
    : null;
  return (
    <span className="cg-caption">
      {kind && <ConceptMark kind={kind} />}
      {kind ? text.slice(1).trim() : text}
    </span>
  );
}

/**
 * Плашки строки сводки «Коротко» и блока «Главного»: сущность — белый чип, знак домена, группы режима или потребности —
 * у первого чипа серии одного знака (runStarts, как в чек-ине клиента; подпись и стрелка серию рвут); стрелка и подпись — тихим значком и текстом.
 */
export function DigestChips({ items }: { items: DigestItem[] }) {
  const starts = runStarts(items.map((it, i) => it.sign ?? i));
  return (
    <span className="cg-chips">
      {items.map((it, i) =>
        it.plain === 'arrow' ? (
          <ConceptMark key={i} kind="arrow" />
        ) : it.plain ? (
          <Caption key={i} text={it.text} />
        ) : (
          <ConceptTag key={i} sign={starts[i] ? it.sign : undefined}>
            {it.text}
          </ConceptTag>
        ),
      )}
    </span>
  );
}
