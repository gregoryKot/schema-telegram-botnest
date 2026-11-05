import { useId, useMemo } from 'react';
import {
  DIGEST_CAPS as CAPS,
  DIGEST_CARD,
  DIGEST_VALUE,
  schemaTag,
} from './conceptInlineStyles';
import { hueVar } from './conceptChipStyle';
import { useConceptSkin } from './conceptSkin';
import { buildConceptGraph } from './conceptGraphModel';
import {
  conceptGraphSource,
  type ConceptGraphFields,
} from './conceptGraphSource';
import {
  DIGEST_TITLE,
  buildConceptDigest,
  type DigestItem,
  type DigestRow,
} from './conceptDigestModel';
import { toneHex } from '../../theme/entityHue';

/**
 * Сводка «Коротко» (#902): тихая карточка над содержанием концептуализации —
 * что с клиентом одним взглядом, без скролла до фигур. Только чтение: тап по
 * плашке ничего не делает; в картинку схемы не идёт (data-export-skip). Метка
 * строки — слева (104px), на узком экране плашки переносятся под неё сами:
 * flex-wrap и flex-basis значения, без замеров ширины. Сущности — плашками в
 * тоне домена или группы (skin.tag + `--h`), свободный текст — строкой.
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

const CHIPS: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '6px 6px',
};

/** Плашки строки: сущность — чип в тоне, слово-связка — текстом между чипами. */
export function DigestChips({ items }: { items: DigestItem[] }) {
  const skin = useConceptSkin();
  return (
    <span style={CHIPS}>
      {items.map((it, i) =>
        it.plain ? (
          <span key={i} style={{ color: 'var(--text-sub)', fontSize: 13 }}>
            {it.text}
          </span>
        ) : (
          <span
            key={i}
            className={skin?.tag}
            style={skin ? hueVar(it.hue) : schemaTag(toneHex(it.hue ?? 0))}
          >
            {it.text}
          </span>
        ),
      )}
    </span>
  );
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
        style={{ ...caps, margin: '0 0 var(--space-10)' }}
      >
        {DIGEST_TITLE}
      </h3>
      <dl style={{ margin: 0, display: 'grid', gap: 'var(--space-10)' }}>
        {rows.map((r) => (
          <div
            key={r.key}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}
          >
            <dt
              className={skin?.label}
              style={{ ...caps, flex: '0 0 104px', lineHeight: '26px' }}
            >
              {r.label}
            </dt>
            <dd
              style={
                skin
                  ? {
                      flex: '1 1 260px',
                      minWidth: 0,
                      margin: 0,
                      lineHeight: 1.5,
                    }
                  : DIGEST_VALUE
              }
            >
              {r.kind === 'chips' ? <DigestChips items={r.items} /> : r.text}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
