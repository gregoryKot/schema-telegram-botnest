// Разделы плашки «Обычно в методе» (ConceptGuideHint, #995): техники «На
// сессии» и задания «Между сессиями», у каждого пункта — история серым
// («делали …», «давали …», guideHistory.ts). Вынесены из плашки по правилу №10.
import type { CSSProperties } from 'react';
import type {
  BetweenSessionsItem,
  TechniqueGuide,
} from '../../schemaTherapy/guide';
import type { ConceptGuideActions, GuideFrom } from './conceptGuide';
import type { GuideNotes } from './guideHistory';
import { hintStyle, labelStyle } from './graphStyles';

const sectionStyle: CSSProperties = { marginTop: 'var(--space-8)' };
// Пояснение и история — тихим серым.
const subStyle: CSSProperties = { color: 'var(--text-sub)' };

// Кнопка, которая выглядит словом: зона нажатия 44 по высоте, а в потоке —
// строка текста (отрицательные поля компенсируют рост, как retryStyle в
// SaveStatusLine). Цвет — текста, акцент на плашке один: «Взять за основу».
export const wordBtn: CSSProperties = {
  minHeight: 44,
  margin: '-12px 0',
  padding: '0 2px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  font: 'inherit',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(var(--fg-rgb),0.3)',
  textUnderlineOffset: 3,
  cursor: 'pointer',
};
// «Дать заданием» стоит в своей строке, ей отрицательные поля не нужны.
const assignBtn: CSSProperties = {
  ...wordBtn,
  margin: 0,
  flexShrink: 0,
  color: 'var(--text-sub)',
};

/** «На сессии»: техника — слово-кнопка (без `actions` — текст), за ней «делали …». */
export function HintTechniques({
  techniques,
  from,
  actions,
  notes,
}: {
  techniques: TechniqueGuide[];
  from: GuideFrom;
  actions?: ConceptGuideActions;
  notes: GuideNotes;
}) {
  if (techniques.length === 0) return null;
  return (
    <div style={sectionStyle}>
      <div style={labelStyle}>На сессии</div>
      <div
        style={{
          ...hintStyle,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '2px var(--space-10)',
        }}
      >
        {techniques.map((t) => {
          const done = notes.technique(t.id);
          return (
            <span key={t.id}>
              {actions ? (
                <button
                  type="button"
                  style={wordBtn}
                  onClick={() => actions.onOpenTechnique(t.id, from)}
                >
                  {t.name}
                </button>
              ) : (
                <span style={{ color: 'var(--text)' }}>{t.name}</span>
              )}
              {done && <span style={subStyle}> · {done}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** «Между сессиями»: пункт, серым пояснение и «давали …», справа «Дать заданием». */
export function HintBetweenSessions({
  items,
  from,
  assign,
  notes,
}: {
  items: BetweenSessionsItem[];
  from: GuideFrom;
  assign?: ConceptGuideActions['onAssign'];
  notes: GuideNotes;
}) {
  if (items.length === 0) return null;
  return (
    <div style={sectionStyle}>
      <div style={labelStyle}>Между сессиями</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, i) => {
          const given = notes.task(item);
          return (
            <li
              key={`${i}:${item.title}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-8)',
                minHeight: assign ? 44 : undefined,
              }}
            >
              <span style={{ ...hintStyle, color: 'var(--text)' }}>
                {item.title}
                {item.kind === 'task' && item.note && (
                  <span style={subStyle}> · {item.note}</span>
                )}
                {given && (
                  <span style={{ ...subStyle, display: 'block' }}>{given}</span>
                )}
              </span>
              {assign && (
                <button
                  type="button"
                  style={{ ...assignBtn, fontSize: 12 }}
                  aria-label={`Дать заданием: ${item.title}`}
                  onClick={() => assign(item, from)}
                >
                  Дать заданием
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
