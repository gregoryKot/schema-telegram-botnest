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

// Инлайн-раскладка — только без skin; со skin её дают классы skin.digest (на сайте
// tcp-dg-* в therapist-concept.css), иначе инлайн спорил бы с ds-label.
const TITLE: React.CSSProperties = { ...CAPS, margin: '0 0 var(--space-10)' };
const LIST: React.CSSProperties = {
  margin: 0,
  display: 'grid',
  gap: 'var(--space-10)',
};
const ROW: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 16px',
};
const TERM: React.CSSProperties = {
  ...CAPS,
  flex: '0 0 104px',
  lineHeight: '26px',
};

/** Карточка сводки; при пустом списке строк не рендерится. */
export function ConceptDigest({ rows }: { rows: DigestRow[] }) {
  const id = useId();
  const skin = useConceptSkin();
  if (rows.length === 0) return null;
  const d = skin?.digest;
  const withLabel = (cls?: string) =>
    skin && cls ? `${skin.label} ${cls}` : undefined;
  return (
    <section
      data-export-skip
      aria-labelledby={id}
      className={skin?.card}
      style={skin ? undefined : DIGEST_CARD}
    >
      <h3 id={id} className={withLabel(d?.title)} style={d ? undefined : TITLE}>
        {DIGEST_TITLE}
      </h3>
      <dl className={d?.list} style={d ? undefined : LIST}>
        {rows.map((r) => (
          <div key={r.key} className={d?.row} style={d ? undefined : ROW}>
            <dt className={withLabel(d?.term)} style={d ? undefined : TERM}>
              {r.label}
            </dt>
            <dd className={d?.value} style={d ? undefined : DIGEST_VALUE}>
              {r.kind === 'chips' ? <DigestChips items={r.items} /> : r.text}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
