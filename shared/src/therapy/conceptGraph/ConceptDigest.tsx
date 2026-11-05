import { useId, useMemo } from 'react';
import {
  DIGEST_CAPS as CAPS,
  DIGEST_CARD,
  DIGEST_VALUE,
} from './conceptInlineStyles';
import { useConceptSkin } from './conceptSkin';
import { buildConceptGraph } from './conceptGraphModel';
import {
  conceptGraphSource,
  type ConceptGraphFields,
} from './conceptGraphSource';
import {
  DIGEST_TITLE,
  buildConceptDigest,
  type DigestRow,
} from './conceptDigestModel';

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

/** Карточка сводки; при пустом списке строк не рендерится. */
export function ConceptDigest({ rows }: { rows: DigestRow[] }) {
  const id = useId();
  const skin = useConceptSkin();
  if (rows.length === 0) return null;
  const caps = skin ? undefined : CAPS;
  return (
    <section
      data-export-skip
      aria-labelledby={id}
      className={skin?.card}
      style={skin ? undefined : DIGEST_CARD}
    >
      <h3
        id={id}
        className={skin?.label}
        style={{ ...caps, margin: '0 0 var(--space-8)' }}
      >
        {DIGEST_TITLE}
      </h3>
      <dl style={{ margin: 0, display: 'grid', gap: 'var(--space-6)' }}>
        {rows.map((r) => (
          <div
            key={r.key}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}
          >
            <dt
              className={skin?.label}
              style={{ ...caps, flex: '0 0 96px', lineHeight: '20px' }}
            >
              {r.label}
            </dt>
            <dd
              style={
                skin
                  ? { flex: '1 1 260px', minWidth: 0, margin: 0 }
                  : DIGEST_VALUE
              }
            >
              {r.text}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
