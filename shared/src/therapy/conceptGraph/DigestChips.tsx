import { ConceptMark, ConceptTag } from './conceptPaper';
import type { DigestItem } from './conceptDigestModel';

// Знак в начале подписи группы («✗ блокированы:») рисуется тихим значком-путём,
// текст модели (он же идёт в экспорт) не меняется.
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
 * Плашки строки сводки «Коротко» и блока «Главного»: сущность — белый чип со
 * знаком домена, группы режима или потребности (без радуги заливок), стрелка и
 * подпись группы — тихим значком и текстом между чипами.
 */
export function DigestChips({ items }: { items: DigestItem[] }) {
  return (
    <span className="cg-chips">
      {items.map((it, i) =>
        it.plain === 'arrow' ? (
          <ConceptMark key={i} kind="arrow" />
        ) : it.plain ? (
          <Caption key={i} text={it.text} />
        ) : (
          <ConceptTag key={i} sign={it.sign}>
            {it.text}
          </ConceptTag>
        ),
      )}
    </span>
  );
}
