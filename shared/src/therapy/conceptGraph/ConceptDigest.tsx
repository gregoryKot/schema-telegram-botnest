import { useId, useMemo } from 'react';
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
import { ConceptSign, DIGEST_SIGN } from './conceptPaper';
import { DigestChips } from './DigestChips';

/**
 * Сводка «Коротко» (#902): лист соломы над содержанием концептуализации — что
 * с клиентом одним взглядом, без скролла до фигур. Только чтение; в картинку
 * схемы не идёт (data-export-skip). У метки строки слева знак раздела
 * (DIGEST_SIGN); сущности — белыми чипами со знаком (DigestChips), свободный
 * текст — строкой. Раскладка — классы skin.digest (сайт: tcp-dg-*).
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
  const d = skin?.digest;
  const withLabel = (cls?: string) =>
    skin && cls ? `${skin.label} ${cls}` : undefined;
  return (
    <section data-export-skip aria-labelledby={id} className={skin?.card}>
      <h3 id={id} className={withLabel(d?.title)}>
        {DIGEST_TITLE}
      </h3>
      <dl className={d?.list}>
        {rows.map((r) => (
          <div key={r.key} className={d?.row}>
            <dt className={withLabel(d?.term)}>
              <ConceptSign sign={DIGEST_SIGN[r.key]} size="row" />
              {r.label}
            </dt>
            <dd className={d?.value}>
              {r.kind === 'chips' ? <DigestChips items={r.items} /> : r.text}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
