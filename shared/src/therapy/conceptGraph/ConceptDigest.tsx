import { useId, useMemo, type CSSProperties } from 'react';
import { buildConceptGraph } from './conceptGraphModel';
import {
  conceptGraphSource,
  type ConceptGraphFields,
} from './conceptGraphSource';
import {
  DIGEST_TITLE,
  buildConceptDigest,
  type DigestRow,
} from './conceptDigest';

/**
 * Сводка «Коротко» (#902): тихая карточка над содержанием концептуализации на
 * сайте (оба вида) и в мини-аппе (над переключателем вида) — что с клиентом
 * одним взглядом, без скролла до фигур. Только чтение: тап по строке ничего не
 * делает; в картинку схемы не идёт (data-export-skip). Метка строки — слева
 * (96px), на узком экране значение переносится под неё само: flex-wrap и
 * flex-basis значения, без замеров ширины.
 */

/** Поля концептуализации, из которых строится сводка: схема случая и цели. */
export interface ConceptDigestFields extends ConceptGraphFields {
  goals?: string | null;
}

/**
 * Строки сводки по концептуализации с черновиком поверх (та же склейка, что у
 * conceptGraphSource в видах «Схема»). Форма обращения модели не нужна: она
 * красит только подсказки «чего не хватает», которых в сводке нет, — поэтому
 * хук не зависит от контекста формы обращения и считает строки раз на данные.
 */
export function useConceptDigest(
  concept: ConceptDigestFields | null | undefined,
  local?: ConceptDigestFields,
): DigestRow[] {
  return useMemo(() => {
    const c = { ...concept, ...local };
    const graph = buildConceptGraph(conceptGraphSource(c), (ty) => ty);
    return buildConceptDigest(graph, c.goals);
  }, [concept, local]);
}

const CAPS: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-sub)',
};

const CARD: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-12)',
  background: 'var(--surface)',
  padding: 'var(--space-12) var(--space-14)',
  marginBottom: 'var(--space-16)',
};

const VALUE: CSSProperties = {
  flex: '1 1 260px',
  minWidth: 0,
  margin: 0,
  fontSize: 14,
  lineHeight: 1.45,
  color: 'var(--text)',
};

/** Карточка сводки; при пустом списке строк не рендерится. */
export function ConceptDigest({ rows }: { rows: DigestRow[] }) {
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <section data-export-skip aria-labelledby={id} style={CARD}>
      <h3 id={id} style={{ ...CAPS, margin: '0 0 var(--space-8)' }}>
        {DIGEST_TITLE}
      </h3>
      <dl style={{ margin: 0, display: 'grid', gap: 'var(--space-6)' }}>
        {rows.map((r) => (
          <div
            key={r.key}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}
          >
            <dt style={{ ...CAPS, flex: '0 0 96px', lineHeight: '20px' }}>
              {r.label}
            </dt>
            <dd style={VALUE}>{r.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
